import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http as mswHttp } from 'msw';
import { BASE, errorResponse } from '../../mocks/helpers.js';
import { renderWithProviders } from '../../test/renderWithProviders.js';
import { server } from '../../test/setup.js';
import { createHandlers, SEED_IDS } from './mocks.js';
import NoticePage from './pages/NoticePage.jsx';
import PolicyDocumentPage from './pages/PolicyDocumentPage.jsx';
import PushNotificationPage from './pages/PushNotificationPage.jsx';
import RecommendationMessagePage from './pages/RecommendationMessagePage.jsx';
import { fromInputValue, isFuture, toInputValue } from './time.js';

// Tests that type a reason in the confirm dialog take a few seconds on a slow machine, and the
// end of those flows is waited for longer than the 1 s default of Testing Library.
const SLOW = 20000;
const WAIT = { timeout: 10000 };

// Fresh in-memory data for every test.
const useMockData = () => server.use(...createHandlers());

// Records the changes (path, header and body) of one method and path and lets the real mock answer.
function recordChanges(method, path) {
  const seen = [];
  server.use(
    mswHttp[method](`${BASE}${path}`, async ({ request }) => {
      seen.push({
        path: new URL(request.url).pathname,
        idempotencyKey: request.headers.get('idempotency-key'),
        body: await request.clone().json(),
      });
      // Nothing is returned: the next handler (the mock data) answers.
    }),
  );
  return seen;
}

// Records the query parameters of a list.
function recordListQueries(path) {
  const seen = [];
  server.use(
    mswHttp.get(`${BASE}${path}`, ({ request }) => {
      seen.push(Object.fromEntries(new URL(request.url).searchParams));
    }),
  );
  return seen;
}

// Looked up in the table only: the confirm dialog repeats the title while it closes.
const inTable = () => within(screen.getByRole('table'));
const rowOf = (text) => inTable().getByText(text).closest('tr');
const inDaysLocal = (days) => toInputValue(new Date(Date.now() + days * 86400000).toISOString());

async function typeReasonAndConfirm(user, reason) {
  await user.type(await screen.findByLabelText('사유'), reason);
  await user.click(screen.getByRole('button', { name: '확인' }));
}

describe('time helpers', () => {
  test('a datetime-local value is Asia/Seoul', () => {
    expect(fromInputValue('2030-01-01T09:00')).toBe('2030-01-01T00:00:00.000Z');
    expect(toInputValue('2030-01-01T00:00:00.000Z')).toBe('2030-01-01T09:00');
    expect(fromInputValue('')).toBeNull();
    expect(toInputValue(null)).toBe('');
    expect(isFuture('2000-01-01T00:00')).toBe(false);
    expect(isFuture('2999-01-01T00:00')).toBe(true);
    expect(isFuture('')).toBe(false);
  });
});

describe('NoticePage', () => {
  test('lists the notices with their state, target and push result', async () => {
    useMockData();
    renderWithProviders(<NoticePage />, { url: '/content/notices' });

    expect(await screen.findByText('총 5건')).toBeInTheDocument();
    expect(inTable().getByText('서비스 점검 안내')).toBeInTheDocument();
    expect(within(rowOf('새 기능이 추가됐어요')).getByText('게시')).toBeInTheDocument();
    expect(
      within(rowOf('새 기능이 추가됐어요')).getByText('발송 120 · 대기 2 · 실패 3 · 건너뜀 15'),
    ).toBeInTheDocument();
    expect(within(rowOf('서비스 점검 안내')).getByText('초안')).toBeInTheDocument();
    expect(within(rowOf('서비스 점검 안내')).getByText('전체 회원')).toBeInTheDocument();
  });

  test('asks M90 for the filters of the URL', async () => {
    useMockData();
    const seen = recordListQueries('/notices');
    renderWithProviders(<NoticePage />, { url: '/content/notices?status=draft&category=policy' });

    expect(await screen.findByText('총 1건')).toBeInTheDocument();
    expect(seen.at(-1)).toMatchObject({ status: 'draft', category: 'policy' });
    expect(inTable().getByText('이용약관이 바뀌어요')).toBeInTheDocument();
  });

  test('offers only the actions a state allows (docs/11 §3.7)', async () => {
    useMockData();
    renderWithProviders(<NoticePage />, { url: '/content/notices' });
    await screen.findByText('총 5건');

    const draft = within(rowOf('서비스 점검 안내'));
    expect(draft.getByRole('button', { name: '수정' })).toBeInTheDocument();
    expect(draft.getByRole('button', { name: '즉시 게시' })).toBeInTheDocument();
    expect(draft.getByRole('button', { name: '예약 게시' })).toBeInTheDocument();
    expect(draft.getByRole('button', { name: '취소' })).toBeInTheDocument();

    const scheduled = within(rowOf('가을 챌린지 이벤트'));
    expect(scheduled.getByRole('button', { name: '취소' })).toBeInTheDocument();
    expect(scheduled.queryByRole('button', { name: '수정' })).not.toBeInTheDocument();
    expect(scheduled.queryByRole('button', { name: '즉시 게시' })).not.toBeInTheDocument();

    expect(within(rowOf('새 기능이 추가됐어요')).queryAllByRole('button')).toHaveLength(0);
    expect(within(rowOf('친구 초대 혜택')).queryAllByRole('button')).toHaveLength(0);
  });

  test('shows the forbidden state for a 403', async () => {
    server.use(
      mswHttp.get(`${BASE}/notices`, () =>
        errorResponse(403, 'COMMON_FORBIDDEN', '서버가 보낸 문구'),
      ),
    );
    renderWithProviders(<NoticePage />, { url: '/content/notices' });

    expect(await screen.findByText('권한이 없어요.')).toBeInTheDocument();
  });

  test(
    'makes a draft for all users after a reason is typed, with an Idempotency-Key',
    async () => {
      const user = userEvent.setup();
      useMockData();
      const seen = recordChanges('post', '/notices');
      renderWithProviders(<NoticePage />, { url: '/content/notices' });

      await user.click(await screen.findByRole('button', { name: '공지 만들기' }));
      await user.type(screen.getByRole('textbox', { name: '제목' }), '새로운 공지');
      await user.type(screen.getByRole('textbox', { name: '내용' }), '공지 내용이에요');
      await user.click(screen.getByRole('button', { name: '저장' }));
      await typeReasonAndConfirm(user, '공지 작성');

      expect(await screen.findByText('총 6건', {}, WAIT)).toBeInTheDocument();
      expect(inTable().getByText('새로운 공지')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument(); // form closed
      expect(seen).toHaveLength(1);
      expect(seen[0].body).toEqual({
        category: 'service',
        title: '새로운 공지',
        body: '공지 내용이에요',
        audienceType: 'all',
        showInList: true,
        sendPush: false,
        reason: '공지 작성',
      });
      expect(seen[0].idempotencyKey).toBeTruthy();
    },
    SLOW,
  );

  test(
    'sends the ids of the chosen users',
    async () => {
      const user = userEvent.setup();
      useMockData();
      const seen = recordChanges('post', '/notices');
      renderWithProviders(<NoticePage />, { url: '/content/notices' });

      await user.click(await screen.findByRole('button', { name: '공지 만들기' }));
      await user.click(screen.getByRole('radio', { name: '이벤트' }));
      await user.type(screen.getByRole('textbox', { name: '제목' }), '당첨 안내');
      await user.type(screen.getByRole('textbox', { name: '내용' }), '축하해요');
      await user.click(screen.getByRole('radio', { name: '지정 회원' }));
      await user.type(screen.getByRole('textbox', { name: '회원 ID' }), 'a4000001, a4000002');
      await user.click(screen.getByRole('button', { name: '저장' }));
      await typeReasonAndConfirm(user, '당첨 공지');

      expect(await screen.findByText('총 6건', {}, WAIT)).toBeInTheDocument();
      expect(seen[0].body).toMatchObject({
        category: 'event',
        audienceType: 'users',
        userIds: ['a4000001', 'a4000002'],
      });
      expect(within(rowOf('당첨 안내')).getByText('지정 회원 2명')).toBeInTheDocument();
    },
    SLOW,
  );

  test(
    'asks for what is missing before the dialog opens',
    async () => {
      const user = userEvent.setup();
      useMockData();
      const seen = recordChanges('post', '/notices');
      renderWithProviders(<NoticePage />, { url: '/content/notices' });

      await user.click(await screen.findByRole('button', { name: '공지 만들기' }));
      await user.click(screen.getByRole('button', { name: '저장' }));
      expect(await screen.findByText('제목을 입력해 주세요.')).toBeInTheDocument();

      await user.type(screen.getByRole('textbox', { name: '제목' }), '제목');
      await user.click(screen.getByRole('button', { name: '저장' }));
      expect(await screen.findByText('내용을 입력해 주세요.')).toBeInTheDocument();

      await user.type(screen.getByRole('textbox', { name: '내용' }), '내용');
      await user.click(screen.getByRole('radio', { name: '정책' }));
      await user.click(screen.getByRole('button', { name: '저장' }));
      expect(await screen.findByText('정책 공지는 약관 버전을 선택해 주세요.')).toBeInTheDocument();

      await user.click(screen.getByRole('radio', { name: '서비스' }));
      await user.type(screen.getByRole('textbox', { name: '이동 화면' }), 'Home');
      await user.click(screen.getByRole('button', { name: '저장' }));
      expect(await screen.findByText(/이동 화면은 영문 소문자로 시작하는 값/)).toBeInTheDocument();

      await user.clear(screen.getByRole('textbox', { name: '이동 화면' }));
      await user.click(screen.getByRole('radio', { name: '지정 회원' }));
      await user.click(screen.getByRole('button', { name: '저장' }));
      expect(await screen.findByText('받을 회원의 ID를 입력해 주세요.')).toBeInTheDocument();

      await user.type(screen.getByRole('textbox', { name: '회원 ID' }), '123');
      await user.click(screen.getByRole('button', { name: '저장' }));
      expect(await screen.findByText('회원 ID는 UUID 형식으로 입력해 주세요.')).toBeInTheDocument();

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(seen).toHaveLength(0);
    },
    SLOW,
  );

  test(
    'edits a draft',
    async () => {
      const user = userEvent.setup();
      useMockData();
      const seen = recordChanges('patch', '/notices/:noticeId');
      renderWithProviders(<NoticePage />, { url: '/content/notices' });
      await screen.findByText('총 5건');

      await user.click(within(rowOf('서비스 점검 안내')).getByRole('button', { name: '수정' }));
      const title = screen.getByRole('textbox', { name: '제목' });
      expect(title).toHaveValue('서비스 점검 안내');
      await user.clear(title);
      await user.type(title, '점검 시간 변경');
      await user.click(screen.getByRole('button', { name: '저장' }));
      await typeReasonAndConfirm(user, '시간 변경');

      await waitFor(() => expect(inTable().getByText('점검 시간 변경')).toBeInTheDocument(), WAIT);
      expect(seen).toHaveLength(1);
      expect(seen[0].path).toBe(`/admin/v1/notices/${SEED_IDS.draftNotice}`);
      expect(seen[0].body).toMatchObject({ title: '점검 시간 변경', reason: '시간 변경' });
      expect(seen[0].idempotencyKey).toBeTruthy();
    },
    SLOW,
  );

  test(
    'publishes a draft now',
    async () => {
      const user = userEvent.setup();
      useMockData();
      const seen = recordChanges('post', '/notices/:noticeId/publish');
      renderWithProviders(<NoticePage />, { url: '/content/notices' });
      await screen.findByText('총 5건');

      await user.click(
        within(rowOf('서비스 점검 안내')).getByRole('button', { name: '즉시 게시' }),
      );
      await typeReasonAndConfirm(user, '바로 게시');

      await waitFor(
        () => expect(within(rowOf('서비스 점검 안내')).getByText('게시')).toBeInTheDocument(),
        WAIT,
      );
      expect(seen).toHaveLength(1);
      expect(seen[0].path).toBe(`/admin/v1/notices/${SEED_IDS.draftNotice}/publish`);
      expect(seen[0].body).toEqual({ scheduledAt: null, reason: '바로 게시' });
      expect(seen[0].idempotencyKey).toBeTruthy();
    },
    SLOW,
  );

  test(
    'schedules a draft for a time after now',
    async () => {
      const user = userEvent.setup();
      useMockData();
      const seen = recordChanges('post', '/notices/:noticeId/publish');
      renderWithProviders(<NoticePage />, { url: '/content/notices' });
      await screen.findByText('총 5건');

      await user.click(
        within(rowOf('서비스 점검 안내')).getByRole('button', { name: '예약 게시' }),
      );
      const input = screen.getByLabelText('게시 시각');

      fireEvent.change(input, { target: { value: '2000-01-01T09:00' } });
      await user.click(screen.getByRole('button', { name: '다음' }));
      expect(await screen.findByText('예약 시각은 지금 이후로 입력해 주세요.')).toBeInTheDocument();
      expect(seen).toHaveLength(0);

      const local = inDaysLocal(2);
      fireEvent.change(input, { target: { value: local } });
      await user.click(screen.getByRole('button', { name: '다음' }));
      await typeReasonAndConfirm(user, '예약 게시');

      await waitFor(
        () => expect(within(rowOf('서비스 점검 안내')).getByText('예약')).toBeInTheDocument(),
        WAIT,
      );
      expect(seen).toHaveLength(1);
      expect(seen[0].body).toEqual({ scheduledAt: fromInputValue(local), reason: '예약 게시' });
    },
    SLOW,
  );

  test(
    'cancels a scheduled notice',
    async () => {
      const user = userEvent.setup();
      useMockData();
      const seen = recordChanges('post', '/notices/:noticeId/cancel');
      renderWithProviders(<NoticePage />, { url: '/content/notices' });
      await screen.findByText('총 5건');

      await user.click(within(rowOf('가을 챌린지 이벤트')).getByRole('button', { name: '취소' }));
      await typeReasonAndConfirm(user, '이벤트 취소');

      await waitFor(
        () =>
          expect(
            within(rowOf('가을 챌린지 이벤트')).queryByRole('button', { name: '취소' }),
          ).not.toBeInTheDocument(),
        WAIT,
      );
      expect(within(rowOf('가을 챌린지 이벤트')).getByText('취소')).toBeInTheDocument();
      expect(seen[0].path).toBe(`/admin/v1/notices/${SEED_IDS.scheduledNotice}/cancel`);
      expect(seen[0].body).toEqual({ reason: '이벤트 취소' });
    },
    SLOW,
  );

  test(
    'shows the server message and keeps the dialog open when the state changed meanwhile',
    async () => {
      const user = userEvent.setup();
      useMockData();
      server.use(
        mswHttp.post(`${BASE}/notices/:noticeId/publish`, () =>
          errorResponse(409, 'ADMIN_STATE_CONFLICT', '지금 상태에서는 할 수 없는 작업이에요.'),
        ),
      );
      renderWithProviders(<NoticePage />, { url: '/content/notices' });
      await screen.findByText('총 5건');

      await user.click(
        within(rowOf('서비스 점검 안내')).getByRole('button', { name: '즉시 게시' }),
      );
      await typeReasonAndConfirm(user, '바로 게시');

      expect(
        await screen.findByText('지금 상태에서는 할 수 없는 작업이에요.', {}, WAIT),
      ).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    },
    SLOW,
  );
});

describe('PushNotificationPage', () => {
  test(
    'makes a notice that sends a push and cannot turn the push off',
    async () => {
      const user = userEvent.setup();
      useMockData();
      const seen = recordChanges('post', '/notices');
      renderWithProviders(<PushNotificationPage />, { url: '/content/push' });

      await user.click(await screen.findByRole('button', { name: '푸시 알림 만들기' }));
      const pushSwitch = screen.getByRole('switch', { name: '푸시 알림 발송' });
      expect(pushSwitch).toBeChecked();
      expect(pushSwitch).toBeDisabled();

      await user.type(screen.getByRole('textbox', { name: '제목' }), '오늘의 미션');
      await user.type(screen.getByRole('textbox', { name: '내용' }), '미션을 확인해 보세요');
      await user.type(screen.getByRole('textbox', { name: '이동 화면' }), 'home');
      await user.click(screen.getByRole('button', { name: '저장' }));
      await typeReasonAndConfirm(user, '푸시 작성');

      expect(await screen.findByText('총 6건', {}, WAIT)).toBeInTheDocument();
      expect(seen[0].body).toMatchObject({ sendPush: true, linkScreen: 'home' });
      expect(
        within(rowOf('오늘의 미션')).getByText('발송 0 · 대기 0 · 실패 0 · 건너뜀 0'),
      ).toBeInTheDocument();
    },
    SLOW,
  );

  test('the notice form of ADM-32 can turn the push on and off', async () => {
    const user = userEvent.setup();
    useMockData();
    renderWithProviders(<NoticePage />, { url: '/content/notices' });

    await user.click(await screen.findByRole('button', { name: '공지 만들기' }));
    const pushSwitch = screen.getByRole('switch', { name: '푸시 알림 발송' });
    expect(pushSwitch).not.toBeChecked();
    expect(pushSwitch).toBeEnabled();
  });
});

describe('PolicyDocumentPage', () => {
  test('lists the versions and offers "게시" only for a version that is not published', async () => {
    useMockData();
    renderWithProviders(<PolicyDocumentPage />, { url: '/content/policies' });

    expect(await screen.findByText('총 4건')).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(4);
    expect(screen.getAllByRole('button', { name: '게시' })).toHaveLength(1);
    expect(screen.getAllByText('게시됨')).toHaveLength(3);
    expect(screen.getByText('미게시')).toBeInTheDocument();
    expect(screen.getByText('필요')).toBeInTheDocument(); // the unpublished version asks again
    expect(screen.getByText('개인정보 처리방침')).toBeInTheDocument();
  });

  test('shows the body of a version', async () => {
    const user = userEvent.setup();
    useMockData();
    renderWithProviders(<PolicyDocumentPage />, { url: '/content/policies' });
    await screen.findByText('총 4건');

    await user.click(
      within(screen.getByText('미게시').closest('tr')).getByRole('button', { name: '본문 보기' }),
    );

    expect(await screen.findByText('제1조 (목적) 개정된 이용 약관이에요.')).toBeInTheDocument();
  });

  test(
    'publishes a version after a reason is typed',
    async () => {
      const user = userEvent.setup();
      useMockData();
      const seen = recordChanges('post', '/policy-documents/:versionId/publish');
      renderWithProviders(<PolicyDocumentPage />, { url: '/content/policies' });
      await screen.findByText('총 4건');

      await user.click(screen.getByRole('button', { name: '게시' }));
      expect(await screen.findByText(/게시하면 수정할 수 없어요/)).toBeInTheDocument();
      await typeReasonAndConfirm(user, '시행 준비 완료');

      await waitFor(() => expect(screen.getAllByText('게시됨')).toHaveLength(4), WAIT);
      expect(screen.queryByRole('button', { name: '게시' })).not.toBeInTheDocument();
      expect(seen[0].path).toBe(`/admin/v1/policy-documents/${SEED_IDS.unpublishedPolicy}/publish`);
      expect(seen[0].body).toEqual({ reason: '시행 준비 완료' });
      expect(seen[0].idempotencyKey).toBeTruthy();
    },
    SLOW,
  );

  test(
    'makes a new version that is not published yet',
    async () => {
      const user = userEvent.setup();
      useMockData();
      const seen = recordChanges('post', '/policy-documents');
      renderWithProviders(<PolicyDocumentPage />, { url: '/content/policies' });

      await user.click(await screen.findByRole('button', { name: '새 버전 만들기' }));
      await user.click(screen.getByRole('button', { name: '저장' }));
      expect(await screen.findByText('버전을 입력해 주세요.')).toBeInTheDocument();
      await user.type(screen.getByRole('textbox', { name: '버전' }), '2.0');
      await user.click(screen.getByRole('button', { name: '저장' }));
      expect(await screen.findByText('본문을 입력해 주세요.')).toBeInTheDocument();
      await user.type(screen.getByRole('textbox', { name: '본문' }), '새 약관 본문');
      await user.click(screen.getByRole('button', { name: '저장' }));
      expect(await screen.findByText('시행 시각을 입력해 주세요.')).toBeInTheDocument();
      expect(seen).toHaveLength(0);

      fireEvent.change(screen.getByLabelText('시행 시각'), {
        target: { value: '2030-01-01T09:00' },
      });
      await user.click(screen.getByRole('switch', { name: '다시 동의 받기' }));
      await user.click(screen.getByRole('button', { name: '저장' }));
      await typeReasonAndConfirm(user, '약관 개정');

      expect(await screen.findByText('총 5건', {}, WAIT)).toBeInTheDocument();
      expect(seen).toHaveLength(1);
      expect(seen[0].body).toEqual({
        documentType: 'terms',
        version: '2.0',
        body: '새 약관 본문',
        effectiveAt: '2030-01-01T00:00:00.000Z',
        requiresReconsent: true,
        reason: '약관 개정',
      });
      expect(screen.getAllByText('미게시')).toHaveLength(2);
    },
    SLOW,
  );

  test(
    'shows the server message when the version already exists',
    async () => {
      const user = userEvent.setup();
      useMockData();
      renderWithProviders(<PolicyDocumentPage />, { url: '/content/policies' });

      await user.click(await screen.findByRole('button', { name: '새 버전 만들기' }));
      await user.type(screen.getByRole('textbox', { name: '버전' }), '1.0'); // terms 1.0 exists
      await user.type(screen.getByRole('textbox', { name: '본문' }), '본문');
      fireEvent.change(screen.getByLabelText('시행 시각'), {
        target: { value: '2030-01-01T09:00' },
      });
      await user.click(screen.getByRole('button', { name: '저장' }));
      await typeReasonAndConfirm(user, '중복 확인');

      expect(
        await screen.findByText('지금 상태에서는 할 수 없는 작업이에요.', {}, WAIT),
      ).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    },
    SLOW,
  );
});

describe('RecommendationMessagePage', () => {
  test('lists the messages with their condition, period and state', async () => {
    useMockData();
    renderWithProviders(<RecommendationMessagePage />, { url: '/content/messages' });

    expect(await screen.findByText('총 3건')).toBeInTheDocument();
    const slot = within(rowOf('아침 운동으로 하루를 시작해요!'));
    expect(slot.getByText('시간대')).toBeInTheDocument();
    expect(slot.getByText('6~9시')).toBeInTheDocument();
    expect(slot.getByText('중지')).toBeInTheDocument();
    expect(slot.getByText('exercise')).toBeInTheDocument();
    const inactive = within(rowOf('3일째 쉬고 있어요. 가볍게 다시 시작해요.'));
    expect(inactive.getByText('미접속 일수')).toBeInTheDocument();
    expect(inactive.getByText('3일')).toBeInTheDocument();
    expect(
      within(rowOf('오늘도 작은 미션 하나부터 시작해 볼까요?')).getByText('사용'),
    ).toBeInTheDocument();
  });

  test(
    'makes a message that is shown after some days without a visit',
    async () => {
      const user = userEvent.setup();
      useMockData();
      const seen = recordChanges('post', '/recommendation-messages');
      renderWithProviders(<RecommendationMessagePage />, { url: '/content/messages' });

      await user.click(await screen.findByRole('button', { name: '추천 문구 만들기' }));
      await user.type(screen.getByRole('textbox', { name: '문구' }), '보고 싶었어요!');
      await user.click(screen.getByRole('radio', { name: '미접속 일수' }));
      await user.click(screen.getByRole('button', { name: '저장' }));
      expect(
        await screen.findByText('미접속 일수를 1~365 사이의 정수로 입력해 주세요.'),
      ).toBeInTheDocument();
      expect(seen).toHaveLength(0);

      await user.type(screen.getByRole('spinbutton', { name: '미접속 일수' }), '5');
      await user.click(screen.getByRole('button', { name: '저장' }));
      await typeReasonAndConfirm(user, '문구 추가');

      expect(await screen.findByText('총 4건', {}, WAIT)).toBeInTheDocument();
      expect(seen).toHaveLength(1);
      expect(seen[0].body).toEqual({
        message: '보고 싶었어요!',
        conditionType: 'inactive_days',
        conditionParams: { days: 5 },
        categoryCode: null,
        priority: 50,
        startsAt: null,
        endsAt: null,
        isActive: true,
        reason: '문구 추가',
      });
      expect(seen[0].idempotencyKey).toBeTruthy();
    },
    SLOW,
  );

  test(
    'a time slot needs two different hours',
    async () => {
      const user = userEvent.setup();
      useMockData();
      const seen = recordChanges('post', '/recommendation-messages');
      renderWithProviders(<RecommendationMessagePage />, { url: '/content/messages' });

      await user.click(await screen.findByRole('button', { name: '추천 문구 만들기' }));
      await user.type(screen.getByRole('textbox', { name: '문구' }), '저녁 산책 어때요?');
      await user.click(screen.getByRole('radio', { name: '시간대' }));
      await user.click(screen.getByRole('button', { name: '저장' }));
      expect(
        await screen.findByText('시작·종료 시각을 0~23 사이의 정수로 입력해 주세요.'),
      ).toBeInTheDocument();

      await user.type(screen.getByRole('spinbutton', { name: '시작 시각' }), '18');
      await user.type(screen.getByRole('spinbutton', { name: '종료 시각' }), '18');
      await user.click(screen.getByRole('button', { name: '저장' }));
      expect(
        await screen.findByText('시작 시각과 종료 시각은 같을 수 없어요.'),
      ).toBeInTheDocument();

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(seen).toHaveLength(0);
    },
    SLOW,
  );

  test('the end of the period cannot be before its start', async () => {
    const user = userEvent.setup();
    useMockData();
    renderWithProviders(<RecommendationMessagePage />, { url: '/content/messages' });

    await user.click(await screen.findByRole('button', { name: '추천 문구 만들기' }));
    await user.type(screen.getByRole('textbox', { name: '문구' }), '기간 테스트');
    fireEvent.change(screen.getByLabelText('시작 시각 (기간)'), {
      target: { value: '2030-02-01T09:00' },
    });
    fireEvent.change(screen.getByLabelText('종료 시각 (기간)'), {
      target: { value: '2030-01-01T09:00' },
    });
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByText('종료 시각은 시작 시각 이후여야 해요.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test(
    'turns a message off',
    async () => {
      const user = userEvent.setup();
      useMockData();
      const seen = recordChanges('patch', '/recommendation-messages/:messageId');
      renderWithProviders(<RecommendationMessagePage />, { url: '/content/messages' });
      await screen.findByText('총 3건');

      await user.click(
        within(rowOf('오늘도 작은 미션 하나부터 시작해 볼까요?')).getByRole('button', {
          name: '수정',
        }),
      );
      expect(screen.getByRole('textbox', { name: '문구' })).toHaveValue(
        '오늘도 작은 미션 하나부터 시작해 볼까요?',
      );
      await user.click(screen.getByRole('switch', { name: '사용' }));
      await user.click(screen.getByRole('button', { name: '저장' }));
      await typeReasonAndConfirm(user, '잠시 중지');

      await waitFor(
        () =>
          expect(
            within(rowOf('오늘도 작은 미션 하나부터 시작해 볼까요?')).getByText('중지'),
          ).toBeInTheDocument(),
        WAIT,
      );
      expect(seen).toHaveLength(1);
      expect(seen[0].path).toBe(`/admin/v1/recommendation-messages/${SEED_IDS.activeMessage}`);
      expect(seen[0].body).toMatchObject({
        isActive: false,
        conditionType: 'always',
        reason: '잠시 중지',
      });
    },
    SLOW,
  );
});
