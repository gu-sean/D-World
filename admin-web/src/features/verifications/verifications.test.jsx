import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { http as mswHttp, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { server } from '../../test/setup.js';
import { handlers } from './mocks.js';
import AppealListPage from './pages/AppealListPage.jsx';
import AppealReviewPage from './pages/AppealReviewPage.jsx';
import VerificationCriteriaPage from './pages/VerificationCriteriaPage.jsx';
import VerificationDetailPage from './pages/VerificationDetailPage.jsx';
import VerificationQueuePage from './pages/VerificationQueuePage.jsx';

// httpClient.js reads the base URL when it is loaded, so set it before the pages are imported.
vi.hoisted(() => {
  import.meta.env.VITE_ADMIN_API_BASE_URL = '/admin/v1';
});

const RECORD_ID = 'a0000000-0000-4000-8000-000000000001';
const APPEAL_ID = 'e0000000-0000-4000-8000-000000000001';

const renderAt = (path) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/verifications" element={<VerificationQueuePage />} />
          <Route path="/verifications/appeals" element={<AppealListPage />} />
          <Route path="/verifications/appeals/:appealId" element={<AppealReviewPage />} />
          <Route path="/verifications/criteria" element={<VerificationCriteriaPage />} />
          <Route path="/verifications/:recordId" element={<VerificationDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => server.use(...handlers));

// Picks "승인"/"이의 인정" etc. and opens the confirm modal of the decision form.
const openDecisionModal = async (user, choice, submitText) => {
  await user.click(await screen.findByLabelText(choice));
  await user.click(screen.getByRole('button', { name: submitText }));
  return screen.findByRole('dialog');
};

describe('ADM-07 queue', () => {
  it('shows the queue with status tags and the number of decisions made today', async () => {
    renderAt('/verifications');
    expect(await screen.findByText('가상 미션 1')).toBeInTheDocument();
    expect(screen.getByText('오늘 처리한 판정')).toBeInTheDocument();
    expect(screen.getAllByText('검토 중').length).toBeGreaterThan(0);
  });

  it('shows the empty state when nothing is waiting', async () => {
    server.use(
      mswHttp.get('/admin/v1/verifications', () =>
        HttpResponse.json({ items: [], page: 1, size: 20, totalCount: 0 }),
      ),
    );
    renderAt('/verifications');
    expect(await screen.findByText('결과가 없어요.')).toBeInTheDocument();
  });

  it('shows the server error text', async () => {
    server.use(
      mswHttp.get('/admin/v1/verifications', () =>
        HttpResponse.json(
          { error: { code: 'COMMON_INTERNAL', message: '잠시 후 다시 시도해 주세요.' } },
          { status: 500 },
        ),
      ),
    );
    renderAt('/verifications');
    expect(await screen.findByText('잠시 후 다시 시도해 주세요.')).toBeInTheDocument();
  });
});

describe('ADM-08 detail', () => {
  it('shows the measured values and the flags of the current result', async () => {
    renderAt(`/verifications/${RECORD_ID}`);
    expect(await screen.findByText('인정 횟수')).toBeInTheDocument();
    expect(screen.getByText('신뢰도 낮음')).toBeInTheDocument();
  });

  it('blocks the decision without a reason', async () => {
    const user = userEvent.setup();
    let called = false;
    server.use(
      mswHttp.post('/admin/v1/verifications/:id/decisions', () => {
        called = true;
        return HttpResponse.json({ status: 'approved' });
      }),
    );
    renderAt(`/verifications/${RECORD_ID}`);
    const dialog = await openDecisionModal(user, '승인', '판정 저장');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));
    expect(await within(dialog).findByText('사유를 입력해 주세요.')).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('shows the error text of the server when the decision fails', async () => {
    const user = userEvent.setup();
    server.use(
      mswHttp.post('/admin/v1/verifications/:id/decisions', () =>
        HttpResponse.json(
          {
            error: { code: 'VERIFICATION_NOT_REVIEWABLE', message: '이미 처리된 인증이에요.' },
          },
          { status: 409 },
        ),
      ),
    );
    renderAt(`/verifications/${RECORD_ID}`);
    const dialog = await openDecisionModal(user, '거절', '판정 저장');
    await user.type(within(dialog).getByLabelText('사유'), '증거가 부족합니다');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));
    expect(await within(dialog).findByText('이미 처리된 인증이에요.')).toBeInTheDocument();
  });
});

describe('ADM-09 appeals', () => {
  it('lists open appeals', async () => {
    renderAt('/verifications/appeals');
    expect(
      await screen.findByText('운동 중인 사진이 맞아요. 다시 확인해 주세요.'),
    ).toBeInTheDocument();
  });

  it('resolves an appeal with a reason and an Idempotency-Key', { timeout: 20000 }, async () => {
    let seen;
    server.use(
      mswHttp.post('/admin/v1/appeals/:id/resolution', async ({ request }) => {
        seen = { key: request.headers.get('idempotency-key'), body: await request.json() };
        return HttpResponse.json({ status: 'accepted' });
      }),
    );
    const user = userEvent.setup();
    renderAt(`/verifications/appeals/${APPEAL_ID}`);
    const dialog = await openDecisionModal(user, '이의 인정', '처리 저장');
    await user.type(within(dialog).getByLabelText('사유'), '증거가 충분합니다');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));
    await waitFor(() => expect(seen).toBeDefined());
    expect(seen.body).toEqual({ decision: 'approved', reason: '증거가 충분합니다' });
    expect(seen.key).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('ADM-10 criteria', () => {
  it('lists the criteria versions', async () => {
    renderAt('/verifications/criteria');
    expect(await screen.findByText('운동')).toBeInTheDocument();
    expect(screen.getByText('카메라')).toBeInTheDocument();
  });

  it(
    'shows CRITERIA_RULES_INVALID text when the server rejects the rules',
    { timeout: 30000 },
    async () => {
      server.use(
        mswHttp.post('/admin/v1/verification-criteria', () =>
          HttpResponse.json(
            {
              error: {
                code: 'CRITERIA_RULES_INVALID',
                message: '판정 기준 형식이 맞지 않아요.',
                details: { fields: ['rules'] },
              },
            },
            { status: 400 },
          ),
        ),
      );
      const user = userEvent.setup();
      renderAt('/verifications/criteria');
      await screen.findByText('운동');
      await user.click(screen.getByRole('button', { name: '새 버전 추가' }));
      const form = await screen.findByRole('dialog');
      const [category, method] = within(form).getAllByRole('combobox');
      await user.click(category);
      await user.click(await screen.findByTitle('운동'));
      await user.click(method);
      await user.click(await screen.findByTitle('카메라', { selector: '.ant-select-item-option' }));
      await user.click(form.querySelector('textarea'));
      await user.paste('{"minConfidence": 5}');
      await user.click(within(form).getByRole('button', { name: '저장' }));

      const dialogs = await screen.findAllByRole('dialog');
      const confirm = dialogs[dialogs.length - 1];
      await user.type(within(confirm).getByLabelText('사유'), '기준 조정');
      await user.click(within(confirm).getByRole('button', { name: '확인' }));
      expect(await within(confirm).findByText('판정 기준 형식이 맞지 않아요.')).toBeInTheDocument();
    },
  );
});
