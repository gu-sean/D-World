import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http as mswHttp, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { BASE, errorResponse } from '../../mocks/helpers.js';
import { renderWithProviders } from '../../test/renderWithProviders.js';
import { server } from '../../test/setup.js';
import { createHandlers, SEED_IDS } from './mocks.js';
import AccountActionPage from './pages/AccountActionPage.jsx';
import UserDetailPage from './pages/UserDetailPage.jsx';
import UserListPage from './pages/UserListPage.jsx';
import WithdrawalListPage from './pages/WithdrawalListPage.jsx';

// Tests that type a reason in the confirm dialog take a few seconds on a slow machine.
const SLOW = 20000;
// The end of those flows (the dialog closes, the mutation finishes, the list is asked again) is
// waited for longer than the 1 s default of Testing Library, for the same reason.
const WAIT = { timeout: 10000 };

// Fresh in-memory data for every test.
const useMockData = () => server.use(...createHandlers());

// Records the changes (header and body) of a path and lets the real mock answer.
function recordChanges(method, path) {
  const seen = [];
  server.use(
    mswHttp[method](`${BASE}${path}`, async ({ request }) => {
      seen.push({
        idempotencyKey: request.headers.get('idempotency-key'),
        body: await request.clone().json(),
      });
      // Nothing is returned: the next handler (the mock data) answers.
    }),
  );
  return seen;
}

// A GET recorder of the query parameters of M10.
function recordUserQueries() {
  const seen = [];
  server.use(
    mswHttp.get(`${BASE}/users`, ({ request }) => {
      seen.push(Object.fromEntries(new URL(request.url).searchParams));
    }),
  );
  return seen;
}

const renderDetail = (userId) =>
  renderWithProviders(
    <Routes>
      <Route path="/users/:userId" element={<UserDetailPage />} />
    </Routes>,
    { url: `/users/${userId}` },
  );

const renderAction = (userId, search = '') =>
  renderWithProviders(
    <Routes>
      <Route path="/users/:userId/actions/new" element={<AccountActionPage />} />
      <Route path="/users/:userId" element={<div>user detail</div>} />
    </Routes>,
    { url: `/users/${userId}/actions/new${search}` },
  );

async function typeReasonAndConfirm(user, reason) {
  await user.type(await screen.findByLabelText('사유'), reason);
  await user.click(screen.getByRole('button', { name: '확인' }));
}

describe('UserListPage', () => {
  test('shows the first page, the total and the masked values as the server sent them', async () => {
    useMockData();
    renderWithProviders(<UserListPage />, { url: '/users' });

    expect(await screen.findByText('총 45건')).toBeInTheDocument();
    expect(screen.getAllByText('정상').length).toBeGreaterThan(0);
    expect(screen.getAllByText('010-****-1020')).toHaveLength(1); // user 20 joined on the 21st
    expect(screen.getAllByRole('row')).toHaveLength(21); // the header and 20 users
  });

  test('searching by nickname writes it to the URL and shows only that user', async () => {
    const user = userEvent.setup();
    useMockData();
    renderWithProviders(<UserListPage />, { url: '/users' });
    await screen.findByText('총 45건');

    await user.type(screen.getByLabelText('닉네임 또는 회원 ID'), '회원07');
    await user.click(screen.getByRole('button', { name: '검색' }));

    expect(await screen.findByText('총 1건')).toBeInTheDocument();
    expect(screen.getByText('회원07')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('query=');
  });

  test('asks M10 for the filters of the URL (status, restricted, joinedFrom, joinedTo)', async () => {
    useMockData();
    const seen = recordUserQueries();
    renderWithProviders(<UserListPage />, {
      url: '/users?status=active&restricted=false&joinedFrom=2026-10-05&joinedTo=2026-10-05',
    });

    // Users 4 and 32 joined on the 5th.
    expect(await screen.findByText('총 2건')).toBeInTheDocument();
    expect(seen.at(-1)).toMatchObject({
      status: 'active',
      restricted: 'false',
      joinedFrom: '2026-10-05',
      joinedTo: '2026-10-05',
      sort: 'createdAt,desc',
      page: '1',
      size: '20',
    });
  });

  test('shows the restriction end date of a restricted user', async () => {
    useMockData();
    renderWithProviders(<UserListPage />, { url: '/users?restricted=true' });

    expect(await screen.findByText('총 1건')).toBeInTheDocument();
    expect(screen.getByText('회원02')).toBeInTheDocument();
    expect(screen.getByText('2099-12-31 09:00')).toBeInTheDocument(); // KST
    expect(screen.getByText('까지')).toBeInTheDocument();
  });

  test('clicking a row opens the detail of that user', async () => {
    const user = userEvent.setup();
    useMockData();
    renderWithProviders(<UserListPage />, { url: '/users?query=회원07' });

    await user.click(await screen.findByText('회원07'));

    expect(screen.getByTestId('location')).toHaveTextContent(/^\/users\/a0000000-/);
  });

  test('shows the forbidden state for a 403', async () => {
    server.use(
      mswHttp.get(`${BASE}/users`, () =>
        errorResponse(403, 'COMMON_FORBIDDEN', '서버가 보낸 문구'),
      ),
    );
    renderWithProviders(<UserListPage />, { url: '/users' });

    expect(await screen.findByText('권한이 없어요.')).toBeInTheDocument();
  });
});

describe('UserDetailPage', () => {
  test('shows the basic tab of a user without a restriction', async () => {
    useMockData();
    renderDetail(SEED_IDS.plainUser);

    expect(await screen.findByText('회원01')).toBeInTheDocument();
    expect(screen.getByText('010-****-1001')).toBeInTheDocument();
    expect(screen.getByText('u***@example.com')).toBeInTheDocument();
    expect(screen.getByText('phone')).toBeInTheDocument(); // the login methods
    expect(screen.getByRole('link', { name: '계정 조치 만들기' })).toHaveAttribute(
      'href',
      `/users/${SEED_IDS.plainUser}/actions/new`,
    );
    expect(screen.queryByRole('button', { name: '해제' })).not.toBeInTheDocument();
  });

  test('shows a message for a user that does not exist', async () => {
    useMockData();
    renderDetail('a0000000-0000-4000-8000-00000000ffff');

    expect(await screen.findByText('찾을 수 없어요.')).toBeInTheDocument();
  });

  test(
    'lifts a restriction in force after a reason is typed, with an Idempotency-Key',
    async () => {
      const user = userEvent.setup();
      useMockData();
      const seen = recordChanges('post', '/account-actions/:actionId/lift');
      renderDetail(SEED_IDS.restrictedUser);

      expect(await screen.findByText('반복 부정 인증')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '해제' }));
      await typeReasonAndConfirm(user, '오탐 확인');

      await waitFor(
        () => expect(screen.queryByRole('button', { name: '해제' })).not.toBeInTheDocument(),
        WAIT,
      );
      expect(seen).toHaveLength(1);
      expect(seen[0].body).toEqual({ reason: '오탐 확인' });
      expect(seen[0].idempotencyKey).toBeTruthy();
    },
    SLOW,
  );

  test('does not send the lift without a reason', async () => {
    const user = userEvent.setup();
    useMockData();
    const seen = recordChanges('post', '/account-actions/:actionId/lift');
    renderDetail(SEED_IDS.restrictedUser);

    await user.click(await screen.findByRole('button', { name: '해제' }));
    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(await screen.findByText('사유를 입력해 주세요.')).toBeInTheDocument();
    expect(seen).toHaveLength(0);
  });

  test('the activity tab lists the activities of the user', async () => {
    const user = userEvent.setup();
    useMockData();
    renderDetail(SEED_IDS.plainUser);

    await user.click(await screen.findByRole('tab', { name: '활동' }));

    expect(await screen.findByText('verification 활동 1')).toBeInTheDocument();
    expect(screen.getByText('총 30건')).toBeInTheDocument();
  });
});

describe('AccountActionPage', () => {
  test(
    'sends a warning after the reason is typed and goes back to the user',
    async () => {
      const user = userEvent.setup();
      useMockData();
      const seen = recordChanges('post', '/users/:userId/account-actions');
      renderAction(SEED_IDS.plainUser);

      await user.click(await screen.findByRole('button', { name: '다음' }));
      expect(screen.getByText('입력한 사유는 회원에게도 보여요.')).toBeInTheDocument();
      await typeReasonAndConfirm(user, '경고 사유');

      // toHaveTextContent matches a part of the text, so the whole path is compared.
      await waitFor(
        () =>
          expect(screen.getByTestId('location').textContent).toBe(`/users/${SEED_IDS.plainUser}`),
        WAIT,
      );
      expect(screen.getByText('user detail')).toBeInTheDocument();
      expect(seen).toHaveLength(1);
      expect(seen[0].body).toEqual({ actionType: 'warning', reason: '경고 사유' });
      expect(seen[0].idempotencyKey).toBeTruthy();
    },
    SLOW,
  );

  test('a restriction needs the number of days before the dialog opens', async () => {
    const user = userEvent.setup();
    useMockData();
    renderAction(SEED_IDS.plainUser);

    await user.click(await screen.findByRole('radio', { name: '이용 제한' }));
    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(
      await screen.findByText('이용 제한 일수를 1~365 사이의 정수로 입력해 주세요.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test(
    'sends a restriction with the days and the ticket of the report',
    async () => {
      const user = userEvent.setup();
      useMockData();
      const seen = recordChanges('post', '/users/:userId/account-actions');
      renderAction(SEED_IDS.plainUser, '?ticketId=ticket-1');

      await user.click(await screen.findByRole('radio', { name: '이용 제한' }));
      await user.type(screen.getByRole('spinbutton', { name: '이용 제한 일수' }), '7');
      await user.click(screen.getByRole('button', { name: '다음' }));
      await typeReasonAndConfirm(user, '반복 신고');

      await waitFor(() => expect(seen).toHaveLength(1), WAIT);
      expect(seen[0].body).toEqual({
        actionType: 'restriction',
        reason: '반복 신고',
        days: 7,
        sourceTicketId: 'ticket-1',
      });
    },
    SLOW,
  );

  test(
    'shows the conflict message in the dialog when a restriction is already in force',
    async () => {
      const user = userEvent.setup();
      useMockData();
      renderAction(SEED_IDS.restrictedUser);

      await user.click(await screen.findByRole('radio', { name: '이용 제한' }));
      await user.type(screen.getByRole('spinbutton', { name: '이용 제한 일수' }), '3');
      await user.click(screen.getByRole('button', { name: '다음' }));
      await typeReasonAndConfirm(user, '재제한');

      expect(
        await screen.findByText('이미 진행 중인 이용 제한이 있어요.', {}, WAIT),
      ).toBeInTheDocument();
      expect(screen.getByTestId('location')).toHaveTextContent('actions/new');
    },
    SLOW,
  );
});

describe('WithdrawalListPage', () => {
  const rowOf = (text) => within(screen.getByText(text).closest('tr'));

  test('lists the requests, oldest first, and enables only the allowed buttons (docs/11 §3.6)', async () => {
    useMockData();
    renderWithProviders(<WithdrawalListPage />, { url: '/users/withdrawals' });

    expect(await screen.findByText('총 3건')).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('완료')).toBeInTheDocument(); // 11-02, the oldest
    expect(within(rows[2]).getByText('접수')).toBeInTheDocument(); // 11-09

    const requested = rowOf('접수');
    expect(requested.getByRole('button', { name: '보류' })).toBeEnabled();
    expect(requested.getByRole('button', { name: '처리 시작' })).toBeEnabled();

    const onHold = rowOf('미처리 신고 확인 중');
    expect(onHold.getByRole('button', { name: '보류' })).toBeDisabled();
    expect(onHold.getByRole('button', { name: '처리 시작' })).toBeEnabled();

    const completed = rowOf('완료');
    expect(completed.getByRole('button', { name: '보류' })).toBeDisabled();
    expect(completed.getByRole('button', { name: '처리 시작' })).toBeDisabled();
    expect(screen.getAllByText('삭제 42 · 익명화 1 · 보관 0').length).toBe(2);
  });

  test(
    'holds a request with a reason and an Idempotency-Key',
    async () => {
      const user = userEvent.setup();
      useMockData();
      const seen = recordChanges('patch', '/withdrawal-requests/:requestId');
      renderWithProviders(<WithdrawalListPage />, { url: '/users/withdrawals' });

      await screen.findByText('접수');
      await user.click(rowOf('접수').getByRole('button', { name: '보류' }));
      await typeReasonAndConfirm(user, '본인 확인 필요');

      // The list is asked again: the row is no longer "접수" and shows the new status and reason.
      // (The reason is not looked up by its text alone: the dialog's text box holds it as well.)
      await waitFor(() => expect(screen.queryByText('접수')).not.toBeInTheDocument(), WAIT);
      // Two rows are on hold now (this one and the one of the seed data), so look in its own row.
      const heldRow = within(screen.getByRole('cell', { name: '본인 확인 필요' }).closest('tr'));
      expect(heldRow.getByText('보류', { selector: '.ant-tag' })).toBeInTheDocument();
      expect(seen).toHaveLength(1);
      expect(seen[0].body).toEqual({ status: 'on_hold', reason: '본인 확인 필요' });
      expect(seen[0].idempotencyKey).toBeTruthy();
    },
    SLOW,
  );

  test(
    'starts the withdrawal job of a request that is on hold',
    async () => {
      const user = userEvent.setup();
      useMockData();
      const seen = recordChanges('patch', '/withdrawal-requests/:requestId');
      renderWithProviders(<WithdrawalListPage />, { url: '/users/withdrawals' });

      await screen.findByText('미처리 신고 확인 중');
      await user.click(rowOf('미처리 신고 확인 중').getByRole('button', { name: '처리 시작' }));
      expect(screen.getByText(/되돌릴 수 없어요/)).toBeInTheDocument();
      await typeReasonAndConfirm(user, '신고 종결 확인');

      expect(await screen.findByText('처리 중', {}, WAIT)).toBeInTheDocument();
      expect(seen[0].body).toEqual({ status: 'processing', reason: '신고 종결 확인' });
    },
    SLOW,
  );

  test(
    'shows the server message and keeps the dialog open when the state changed meanwhile',
    async () => {
      const user = userEvent.setup();
      useMockData();
      server.use(
        mswHttp.patch(`${BASE}/withdrawal-requests/:requestId`, () =>
          errorResponse(409, 'ADMIN_STATE_CONFLICT', '지금 상태에서는 할 수 없는 작업이에요.'),
        ),
      );
      renderWithProviders(<WithdrawalListPage />, { url: '/users/withdrawals' });

      await screen.findByText('접수');
      await user.click(rowOf('접수').getByRole('button', { name: '보류' }));
      await typeReasonAndConfirm(user, '보류 사유');

      expect(
        await screen.findByText('지금 상태에서는 할 수 없는 작업이에요.', {}, WAIT),
      ).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    },
    SLOW,
  );

  test('shows the empty state', async () => {
    server.use(
      mswHttp.get(`${BASE}/withdrawal-requests`, () =>
        HttpResponse.json({ items: [], page: 1, size: 20, totalCount: 0 }),
      ),
    );
    renderWithProviders(<WithdrawalListPage />, { url: '/users/withdrawals' });

    expect(await screen.findByText('결과가 없어요.')).toBeInTheDocument();
  });
});
