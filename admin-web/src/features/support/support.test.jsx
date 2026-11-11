import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http as mswHttp } from 'msw';
import { Route, Routes } from 'react-router';
import { BASE, errorResponse } from '../../mocks/helpers.js';
import { renderWithProviders } from '../../test/renderWithProviders.js';
import { server } from '../../test/setup.js';
import { createHandlers, SEED_IDS } from './mocks.js';
import AbuseTicketDetailPage from './pages/AbuseTicketDetailPage.jsx';
import AbuseTicketListPage from './pages/AbuseTicketListPage.jsx';
import InquiryDetailPage from './pages/InquiryDetailPage.jsx';
import InquiryListPage from './pages/InquiryListPage.jsx';

// Tests that type a reason in the confirm dialog take a few seconds on a slow machine, and the
// end of those flows is waited for longer than the 1 s default of Testing Library.
const SLOW = 20000;
const WAIT = { timeout: 10000 };

// Fresh in-memory data for every test.
const useMockData = () => server.use(...createHandlers());

// Records the changes (header and body) of a path and lets the real mock answer.
function recordChanges(path) {
  const seen = [];
  server.use(
    mswHttp.post(`${BASE}${path}`, async ({ request }) => {
      seen.push({
        idempotencyKey: request.headers.get('idempotency-key'),
        body: await request.clone().json(),
      });
      // Nothing is returned: the next handler (the mock data) answers.
    }),
  );
  return seen;
}

// Records the query parameters of M20.
function recordListQueries() {
  const seen = [];
  server.use(
    mswHttp.get(`${BASE}/support-tickets`, ({ request }) => {
      seen.push(Object.fromEntries(new URL(request.url).searchParams));
    }),
  );
  return seen;
}

const renderInquiry = (ticketId) =>
  renderWithProviders(
    <Routes>
      <Route path="/support/inquiries/:ticketId" element={<InquiryDetailPage />} />
    </Routes>,
    { url: `/support/inquiries/${ticketId}` },
  );

const renderAbuse = (ticketId) =>
  renderWithProviders(
    <Routes>
      <Route path="/support/abuse/:ticketId" element={<AbuseTicketDetailPage />} />
    </Routes>,
    { url: `/support/abuse/${ticketId}` },
  );

const events = () => within(screen.getByTestId('ticket-events'));

async function typeReasonAndConfirm(user, reason) {
  await user.type(await screen.findByLabelText('사유'), reason);
  await user.click(screen.getByRole('button', { name: '확인' }));
}

describe('InquiryListPage', () => {
  test('lists the inquiries, oldest first, and asks M20 for ticketType=inquiry', async () => {
    useMockData();
    const seen = recordListQueries();
    renderWithProviders(<InquiryListPage />, { url: '/support/inquiries' });

    expect(await screen.findByText('총 25건')).toBeInTheDocument();
    expect(seen.at(-1)).toMatchObject({
      ticketType: 'inquiry',
      sort: 'receivedAt,asc',
      page: '1',
      size: '20',
    });
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(21); // the header and 20 inquiries
    expect(within(rows[1]).getByText('닉네임을 바꾸고 싶어요')).toBeInTheDocument(); // the oldest
    expect(screen.queryByText('채팅에서 욕설을 해요')).not.toBeInTheDocument(); // a report
  });

  test('asks M20 for the filters of the URL (status, assigned)', async () => {
    useMockData();
    const seen = recordListQueries();
    renderWithProviders(<InquiryListPage />, {
      url: '/support/inquiries?status=received&assigned=none',
    });

    expect(await screen.findByText(/^총 \d+건$/)).toBeInTheDocument();
    expect(seen.at(-1)).toMatchObject({
      ticketType: 'inquiry',
      status: 'received',
      assigned: 'none',
    });
    expect(screen.queryByText('내 정보 > 프로필 수정에서 바꿀 수 있어요.')).not.toBeInTheDocument();
  });

  test('clicking a row opens the detail of that inquiry', async () => {
    const user = userEvent.setup();
    useMockData();
    renderWithProviders(<InquiryListPage />, { url: '/support/inquiries' });

    await user.click(await screen.findByText('닉네임을 바꾸고 싶어요'));

    expect(screen.getByTestId('location')).toHaveTextContent(
      `/support/inquiries/${SEED_IDS.completedInquiry}`,
    );
  });

  test('shows the forbidden state for a 403', async () => {
    server.use(
      mswHttp.get(`${BASE}/support-tickets`, () =>
        errorResponse(403, 'COMMON_FORBIDDEN', '서버가 보낸 문구'),
      ),
    );
    renderWithProviders(<InquiryListPage />, { url: '/support/inquiries' });

    expect(await screen.findByText('권한이 없어요.')).toBeInTheDocument();
  });
});

describe('AbuseTicketListPage', () => {
  test('lists the reports with their target and the number of open reports of the same target', async () => {
    useMockData();
    const seen = recordListQueries();
    renderWithProviders(<AbuseTicketListPage />, { url: '/support/abuse' });

    expect(await screen.findByText('총 5건')).toBeInTheDocument();
    expect(seen.at(-1)).toMatchObject({ ticketType: 'report' });
    expect(screen.getAllByText('회원 · 회원05')).toHaveLength(2);
    expect(screen.getAllByText('2건')).toHaveLength(2); // both reports of that user are open
    expect(screen.getByText('미션 · 아침 스트레칭 10분')).toBeInTheDocument();
    expect(screen.getByText('챌린지 · 30일 달리기 챌린지')).toBeInTheDocument();
  });

  test('filters by the kind of the target', async () => {
    useMockData();
    const seen = recordListQueries();
    renderWithProviders(<AbuseTicketListPage />, { url: '/support/abuse?targetKind=challenge' });

    expect(await screen.findByText('총 1건')).toBeInTheDocument();
    expect(seen.at(-1)).toMatchObject({ ticketType: 'report', targetKind: 'challenge' });
  });

  test('clicking a row opens the detail of that report', async () => {
    const user = userEvent.setup();
    useMockData();
    renderWithProviders(<AbuseTicketListPage />, { url: '/support/abuse' });

    await user.click(await screen.findByText('미션 · 아침 스트레칭 10분'));

    expect(screen.getByTestId('location')).toHaveTextContent(
      `/support/abuse/${SEED_IDS.missionReport}`,
    );
  });
});

describe('InquiryDetailPage', () => {
  test('shows the inquiry, its history and the internal notes', async () => {
    useMockData();
    renderInquiry(SEED_IDS.inReviewInquiry);

    expect(await screen.findByText('지난달 결제 내역이 보이지 않아요.')).toBeInTheDocument();
    expect(screen.getByText('결제 내역을 확인하고 싶어요')).toBeInTheDocument();
    expect(events().getByText('결제 팀에 확인 요청함')).toBeInTheDocument();
    expect(events().getAllByText('내부 기록').length).toBeGreaterThan(0);
    expect(events().getByText('회원에게 보임')).toBeInTheDocument(); // the first "접수" event
    expect(screen.getByRole('link', { name: '목록으로' })).toHaveAttribute(
      'href',
      '/support/inquiries',
    );
  });

  test('shows a message when the ticket is a report', async () => {
    useMockData();
    renderInquiry(SEED_IDS.userReport);

    expect(await screen.findByText('찾을 수 없어요.')).toBeInTheDocument();
  });

  test(
    'assigns the inquiry to me and it goes into review',
    async () => {
      const user = userEvent.setup();
      useMockData();
      const seen = recordChanges('/support-tickets/:ticketId/assign');
      renderInquiry(SEED_IDS.receivedInquiry);

      await user.click(await screen.findByRole('button', { name: '나에게 지정' }));
      await typeReasonAndConfirm(user, '제가 맡을게요');

      expect(await screen.findByText('검토 중', {}, WAIT)).toBeInTheDocument();
      expect(seen).toHaveLength(1);
      expect(seen[0].body).toEqual({ adminId: null, reason: '제가 맡을게요' });
      expect(seen[0].idempotencyKey).toBeTruthy();
    },
    SLOW,
  );

  test(
    'sends a reply that the user sees',
    async () => {
      const user = userEvent.setup();
      useMockData();
      const seen = recordChanges('/support-tickets/:ticketId/events');
      renderInquiry(SEED_IDS.receivedInquiry);

      await user.type(await screen.findByRole('textbox', { name: '내용' }), '답변 드려요');
      await user.click(screen.getByRole('button', { name: '보내기' }));
      await typeReasonAndConfirm(user, '문의 답변');

      await waitFor(() => expect(events().getByText('답변 드려요')).toBeInTheDocument(), WAIT);
      expect(seen).toHaveLength(1);
      expect(seen[0].body).toEqual({
        eventType: 'reply',
        body: '답변 드려요',
        reason: '문의 답변',
      });
      expect(seen[0].idempotencyKey).toBeTruthy();
    },
    SLOW,
  );

  test(
    'leaves an internal note',
    async () => {
      const user = userEvent.setup();
      useMockData();
      const seen = recordChanges('/support-tickets/:ticketId/events');
      renderInquiry(SEED_IDS.receivedInquiry);

      await user.click(await screen.findByRole('radio', { name: '메모' }));
      await user.type(screen.getByRole('textbox', { name: '내용' }), '확인 필요');
      await user.click(screen.getByRole('button', { name: '보내기' }));
      await typeReasonAndConfirm(user, '메모 사유');

      await waitFor(() => expect(events().getByText('확인 필요')).toBeInTheDocument(), WAIT);
      expect(seen[0].body).toEqual({ eventType: 'note', body: '확인 필요', reason: '메모 사유' });
    },
    SLOW,
  );

  test('does not send an empty reply', async () => {
    const user = userEvent.setup();
    useMockData();
    const seen = recordChanges('/support-tickets/:ticketId/events');
    renderInquiry(SEED_IDS.receivedInquiry);

    await user.click(await screen.findByRole('button', { name: '보내기' }));

    expect(await screen.findByText('내용을 입력해 주세요.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(seen).toHaveLength(0);
  });

  test(
    'resolves the inquiry with a reply',
    async () => {
      const user = userEvent.setup();
      useMockData();
      const seen = recordChanges('/support-tickets/:ticketId/resolution');
      renderInquiry(SEED_IDS.receivedInquiry);

      await user.type(
        await screen.findByRole('textbox', { name: '회원에게 보낼 답변' }),
        '앱을 최신 버전으로 업데이트해 주세요',
      );
      await user.click(screen.getByRole('button', { name: '처리 확정' }));
      await typeReasonAndConfirm(user, '답변 완료');

      expect(await screen.findByText('처리 결과', {}, WAIT)).toBeInTheDocument();
      expect(screen.getAllByText('답변만').length).toBeGreaterThan(0);
      expect(screen.queryByRole('button', { name: '처리 확정' })).not.toBeInTheDocument();
      expect(seen).toHaveLength(1);
      expect(seen[0].body).toEqual({
        outcome: 'reply_only',
        userReply: '앱을 최신 버전으로 업데이트해 주세요',
        reason: '답변 완료',
      });
      expect(seen[0].idempotencyKey).toBeTruthy();
    },
    SLOW,
  );

  test('an inquiry cannot be resolved without a reply', async () => {
    const user = userEvent.setup();
    useMockData();
    const seen = recordChanges('/support-tickets/:ticketId/resolution');
    renderInquiry(SEED_IDS.receivedInquiry);

    await user.click(await screen.findByRole('button', { name: '처리 확정' }));

    expect(await screen.findByText('회원에게 보낼 답변을 입력해 주세요.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(seen).toHaveLength(0);
  });

  test('a completed inquiry shows its result and cannot be resolved or assigned again', async () => {
    useMockData();
    renderInquiry(SEED_IDS.completedInquiry);

    expect(await screen.findByText('처리 결과')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '처리 확정' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '나에게 지정' })).toBeDisabled();
  });
});

describe('AbuseTicketDetailPage', () => {
  test('shows the report, a link to the reported user and the number of open reports', async () => {
    useMockData();
    renderAbuse(SEED_IDS.userReport);

    expect(await screen.findByText('챌린지 댓글에서 욕설을 반복해서 썼어요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '회원05' })).toHaveAttribute(
      'href',
      '/users/a0000000-0000-4000-8000-000000000005',
    );
    expect(screen.getByText('2건')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '목록으로' })).toHaveAttribute(
      'href',
      '/support/abuse',
    );
  });

  test(
    'confirms a restriction of the reported user',
    async () => {
      const user = userEvent.setup();
      useMockData();
      const seen = recordChanges('/support-tickets/:ticketId/resolution');
      renderAbuse(SEED_IDS.userReport);

      await user.click(await screen.findByRole('radio', { name: '계정 조치' }));
      await user.click(screen.getByRole('radio', { name: '이용 제한' }));
      await user.type(screen.getByRole('spinbutton', { name: '이용 제한 일수' }), '7');
      await user.type(
        screen.getByRole('textbox', { name: '회원에게 보일 조치 사유' }),
        '반복 욕설',
      );
      await user.click(screen.getByRole('button', { name: '처리 확정' }));
      await typeReasonAndConfirm(user, '신고 확인');

      expect(await screen.findByText('처리 결과', {}, WAIT)).toBeInTheDocument();
      expect(seen).toHaveLength(1);
      expect(seen[0].body).toEqual({
        outcome: 'account_action',
        accountAction: { actionType: 'restriction', reason: '반복 욕설', days: 7 },
        reason: '신고 확인',
      });
    },
    SLOW,
  );

  test(
    'confirms that a reported mission is hidden',
    async () => {
      const user = userEvent.setup();
      useMockData();
      const seen = recordChanges('/support-tickets/:ticketId/resolution');
      renderAbuse(SEED_IDS.missionReport);

      await user.click(await screen.findByRole('radio', { name: '콘텐츠 조치' }));
      await user.click(screen.getByRole('radio', { name: '숨김' }));
      await user.click(screen.getByRole('button', { name: '처리 확정' }));
      await typeReasonAndConfirm(user, '광고 문구 확인');

      expect(await screen.findByText('처리 결과', {}, WAIT)).toBeInTheDocument();
      expect(seen[0].body).toEqual({
        outcome: 'content_action',
        contentAction: 'hidden',
        reason: '광고 문구 확인',
      });
    },
    SLOW,
  );

  test('asks for what the outcome needs before the dialog opens', async () => {
    const user = userEvent.setup();
    useMockData();
    const seen = recordChanges('/support-tickets/:ticketId/resolution');
    renderAbuse(SEED_IDS.userReport);

    await user.click(await screen.findByRole('radio', { name: '계정 조치' }));
    await user.click(screen.getByRole('button', { name: '처리 확정' }));
    expect(await screen.findByText('회원에게 보일 조치 사유를 입력해 주세요.')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '콘텐츠 조치' }));
    await user.click(screen.getByRole('button', { name: '처리 확정' }));
    expect(await screen.findByText('콘텐츠 조치를 선택해 주세요.')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '답변만' }));
    await user.click(screen.getByRole('button', { name: '처리 확정' }));
    expect(await screen.findByText('회원에게 보낼 답변을 입력해 주세요.')).toBeInTheDocument();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(seen).toHaveLength(0);
  });

  test(
    'shows the server message and keeps the dialog open when the ticket is already completed',
    async () => {
      const user = userEvent.setup();
      useMockData();
      server.use(
        mswHttp.post(`${BASE}/support-tickets/:ticketId/resolution`, () =>
          errorResponse(409, 'ADMIN_STATE_CONFLICT', '지금 상태에서는 할 수 없는 작업이에요.'),
        ),
      );
      renderAbuse(SEED_IDS.userReport);

      await user.click(await screen.findByRole('button', { name: '처리 확정' })); // "문제 없음"
      await typeReasonAndConfirm(user, '문제 없음 확인');

      expect(
        await screen.findByText('지금 상태에서는 할 수 없는 작업이에요.', {}, WAIT),
      ).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    },
    SLOW,
  );
});
