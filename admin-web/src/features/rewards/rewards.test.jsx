import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http as mswHttp, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { server } from '../../test/setup.js';

const BASE = '/admin/v1';
const USER = 'a0000000-0000-4000-8000-000000000001';

let PointTransactionListPage;
let PointAdjustmentPage;
let StreakPolicyPage;

beforeAll(async () => {
  // httpClient.js reads the base URL when it is loaded, so stub it before importing the pages.
  vi.stubEnv('VITE_ADMIN_API_BASE_URL', BASE);
  PointTransactionListPage = (await import('./pages/PointTransactionListPage.jsx')).default;
  PointAdjustmentPage = (await import('./pages/PointAdjustmentPage.jsx')).default;
  StreakPolicyPage = (await import('./pages/StreakPolicyPage.jsx')).default;
});

afterAll(() => vi.unstubAllEnvs());

const renderPage = (ui) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('PointTransactionListPage', () => {
  it('shows transactions and the pending points header', async () => {
    server.use(
      mswHttp.get(`${BASE}/point-transactions`, () =>
        HttpResponse.json(
          {
            items: [
              {
                id: '1',
                userId: USER,
                kind: 'manual_grant',
                availableDelta: 50,
                outstandingDelta: 0,
                balanceAfter: 50,
                outstandingAfter: 0,
                sourceType: 'admin_adjustment',
                sourceId: 's',
                reason: '이벤트 보상',
                createdByAdminId: 'x',
                occurredAt: '2026-11-01T01:00:00.000Z',
              },
            ],
            page: 1,
            size: 20,
            totalCount: 1,
          },
          { headers: { 'X-Pending-Points': '40' } },
        ),
      ),
    );
    renderPage(<PointTransactionListPage />);
    expect(await screen.findByText('관리자 지급')).toBeInTheDocument();
    expect(screen.getByText('이벤트 보상')).toBeInTheDocument();
    expect(screen.getByText('검수 대기 중인 보상 합계')).toBeInTheDocument();
  });

  it('shows the empty state', async () => {
    server.use(
      mswHttp.get(`${BASE}/point-transactions`, () =>
        HttpResponse.json({ items: [], page: 1, size: 20, totalCount: 0 }),
      ),
    );
    renderPage(<PointTransactionListPage />);
    expect(await screen.findByText('결과가 없어요.')).toBeInTheDocument();
  });
});

// antd dialogs are slow in jsdom, and the whole suite runs in parallel: allow 20 s per test.
describe('PointAdjustmentPage', { timeout: 20_000 }, () => {
  // Fast input: antd inputs in jsdom are slow with per-key typing.
  const fillForm = async (user, { amount = '100', recovery = false } = {}) => {
    await user.click(screen.getByLabelText('회원 ID'));
    await user.paste(USER);
    if (recovery) await user.click(screen.getByText('회수'));
    fireEvent.change(screen.getByLabelText('포인트'), { target: { value: amount } });
    await user.click(screen.getByRole('button', { name: /조정하기/ }));
    return screen.findByRole('dialog');
  };

  it('asks for a reason in the confirm dialog, then sends the adjustment with an Idempotency-Key', async () => {
    let received;
    server.use(
      mswHttp.post(`${BASE}/point-adjustments`, async ({ request }) => {
        received = { body: await request.json(), key: request.headers.get('idempotency-key') };
        return HttpResponse.json({ id: '1', balanceAfter: 100 }, { status: 201 });
      }),
    );
    const user = userEvent.setup({ delay: null });
    renderPage(<PointAdjustmentPage />);

    const dialog = await fillForm(user);
    expect(within(dialog).getByText('포인트를 조정할까요?')).toBeInTheDocument();
    expect(received).toBeUndefined();
    await user.click(within(dialog).getByLabelText('사유'));
    await user.paste('이벤트');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));

    await waitFor(() => expect(received).toBeDefined());
    expect(received.body).toEqual({
      userId: USER,
      kind: 'manual_grant',
      amount: 100,
      reason: '이벤트',
    });
    expect(received.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(await screen.findByText('처리했어요')).toBeInTheDocument();
  });

  it('blocks the change when the reason is empty', async () => {
    let called = false;
    server.use(
      mswHttp.post(`${BASE}/point-adjustments`, () => {
        called = true;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    const user = userEvent.setup({ delay: null });
    renderPage(<PointAdjustmentPage />);

    const dialog = await fillForm(user, { amount: '5' });
    await user.click(within(dialog).getByRole('button', { name: '확인' }));
    expect(await within(dialog).findByText('사유를 입력해 주세요.')).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('shows the server error in the dialog and keeps the input', async () => {
    server.use(
      mswHttp.post(`${BASE}/point-adjustments`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'POINT_INSUFFICIENT',
              message: '가용 잔액보다 많이 회수할 수 없어요.',
              details: null,
            },
          },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup({ delay: null });
    renderPage(<PointAdjustmentPage />);

    const dialog = await fillForm(user, { amount: '999', recovery: true });
    await user.click(within(dialog).getByLabelText('사유'));
    await user.paste('오지급 회수');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));

    expect(
      await within(dialog).findByText('가용 잔액보다 많이 회수할 수 없어요.'),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText('회원 ID')[0]).toHaveValue(USER);
  });
});

describe('StreakPolicyPage', () => {
  it('lists milestones and marks the one in force', async () => {
    server.use(
      mswHttp.get(`${BASE}/streak-milestone-policies`, () =>
        HttpResponse.json({
          items: [
            {
              id: 'a',
              targetSuccessDays: 7,
              versionNo: 1,
              points: 20,
              userXp: 20,
              petXp: 10,
              effectiveAt: '2026-01-01T00:00:00.000Z',
            },
            {
              id: 'b',
              targetSuccessDays: 7,
              versionNo: 2,
              points: 30,
              userXp: 30,
              petXp: 15,
              effectiveAt: '2026-06-01T00:00:00.000Z',
            },
          ],
        }),
      ),
    );
    renderPage(<StreakPolicyPage />);
    const rows = await screen.findAllByRole('row');
    await waitFor(() => expect(screen.getAllByText('적용 중')).toHaveLength(1));
    expect(
      within(rows.find((row) => row.textContent.includes('v2'))).getByText('적용 중'),
    ).toBeInTheDocument();
  });
});
