import { delay, http as mswHttp, HttpResponse } from 'msw';
import { BASE, checkChange, errorResponse, paginate, sortItems } from '../../mocks/helpers.js';

// MSW handlers for M20~M24 (docs/09 §4). The data lives in memory: a change made on one screen
// is seen on the others until the page is reloaded.

const uuid = (kind, n) => `${kind}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** IDs of the fixed tickets that tests and demos can rely on. */
export const SEED_IDS = {
  receivedInquiry: uuid('e', 1), // received, nobody assigned
  inReviewInquiry: uuid('e', 2), // in review, assigned to another admin, has an internal note
  completedInquiry: uuid('e', 3), // completed with a reply
  userReport: uuid('f', 1), // report of a user, received (same target as userReportTwin)
  userReportTwin: uuid('f', 2),
  missionReport: uuid('f', 3), // report of a mission definition
  challengeReport: uuid('f', 4), // report of a challenge
  completedReport: uuid('f', 5),
};

const ME = 'dev_admin'; // M22 `adminId: null` means "me"
const nowIso = () => new Date().toISOString();
const day = (n, hour = 1) => new Date(Date.UTC(2026, 9, n, hour, 0, 0)).toISOString();

const event = (n, eventType, visibility, body, adminLoginId, createdAt) => ({
  id: uuid('d', n),
  eventType,
  visibility,
  body,
  adminLoginId,
  createdAt,
});

function ticket(fields) {
  const { id, receivedAt, status = 'received', events, ...rest } = fields;
  return {
    reporterNickname: null,
    targetKind: null,
    targetId: null,
    targetSummary: null,
    assignedAdminLoginId: null,
    resolution: null,
    id,
    status,
    receivedAt,
    events: events ?? [
      { ...event(0, 'received', 'user', null, null, receivedAt), id: `d${id.slice(1)}` },
    ],
    ...rest,
  };
}

function seedTickets() {
  const tickets = [
    ticket({
      id: SEED_IDS.receivedInquiry,
      ticketType: 'inquiry',
      category: '오류',
      subject: '앱이 자꾸 종료돼요',
      body: '인증 사진을 올리려고 하면 앱이 꺼져요.',
      reporterNickname: '회원11',
      receivedAt: day(2),
    }),
    ticket({
      id: SEED_IDS.inReviewInquiry,
      ticketType: 'inquiry',
      category: '결제',
      subject: '결제 내역을 확인하고 싶어요',
      body: '지난달 결제 내역이 보이지 않아요.',
      reporterNickname: '회원12',
      status: 'in_review',
      assignedAdminLoginId: 'other_admin',
      receivedAt: day(3),
      events: [
        event(1, 'received', 'user', null, null, day(3)),
        event(2, 'assigned', 'internal', null, 'other_admin', day(3, 2)),
        event(3, 'status_changed', 'internal', null, 'other_admin', day(3, 2)),
        event(4, 'note', 'internal', '결제 팀에 확인 요청함', 'other_admin', day(3, 3)),
      ],
    }),
    ticket({
      id: SEED_IDS.completedInquiry,
      ticketType: 'inquiry',
      category: '계정',
      subject: '닉네임을 바꾸고 싶어요',
      body: '닉네임 변경은 어디서 하나요?',
      reporterNickname: '회원13',
      status: 'completed',
      assignedAdminLoginId: ME,
      receivedAt: day(1),
      events: [
        event(5, 'received', 'user', null, null, day(1)),
        event(6, 'reply', 'user', '내 정보 > 프로필 수정에서 바꿀 수 있어요.', ME, day(1, 4)),
        event(7, 'status_changed', 'internal', null, ME, day(1, 4)),
      ],
      resolution: {
        outcome: 'reply_only',
        userReply: '내 정보 > 프로필 수정에서 바꿀 수 있어요.',
        accountActionId: null,
        contentAction: null,
        resolvedAt: day(1, 4),
      },
    }),
    ticket({
      id: SEED_IDS.userReport,
      ticketType: 'report',
      category: '욕설·비방',
      subject: '채팅에서 욕설을 해요',
      body: '챌린지 댓글에서 욕설을 반복해서 썼어요.',
      reporterNickname: '회원21',
      targetKind: 'user',
      targetId: uuid('a', 5),
      targetSummary: '회원05',
      receivedAt: day(4),
    }),
    ticket({
      id: SEED_IDS.userReportTwin,
      ticketType: 'report',
      category: '욕설·비방',
      subject: '같은 사람이 또 욕설을 했어요',
      body: '어제도 신고했는데 계속해요.',
      reporterNickname: '회원22',
      targetKind: 'user',
      targetId: uuid('a', 5),
      targetSummary: '회원05',
      receivedAt: day(5),
    }),
    ticket({
      id: SEED_IDS.missionReport,
      ticketType: 'report',
      category: '부적절한 콘텐츠',
      subject: '미션 설명이 부적절해요',
      body: '미션 설명에 광고 문구가 들어 있어요.',
      reporterNickname: '회원23',
      targetKind: 'mission_definition',
      targetId: uuid('m', 1),
      targetSummary: '아침 스트레칭 10분',
      receivedAt: day(6),
    }),
    ticket({
      id: SEED_IDS.challengeReport,
      ticketType: 'report',
      category: '허위 정보',
      subject: '챌린지 보상이 거짓이에요',
      body: '보상 안내와 실제가 달라요.',
      reporterNickname: '회원24',
      targetKind: 'challenge',
      targetId: uuid('c', 1),
      targetSummary: '30일 달리기 챌린지',
      status: 'in_review',
      assignedAdminLoginId: ME,
      receivedAt: day(7),
      events: [
        event(8, 'received', 'user', null, null, day(7)),
        event(9, 'assigned', 'internal', null, ME, day(7, 2)),
        event(10, 'status_changed', 'internal', null, ME, day(7, 2)),
      ],
    }),
    ticket({
      id: SEED_IDS.completedReport,
      ticketType: 'report',
      category: '욕설·비방',
      subject: '프로필 사진이 부적절해요',
      body: '프로필 사진에 문제가 있어요.',
      reporterNickname: '회원25',
      targetKind: 'user',
      targetId: uuid('a', 9),
      targetSummary: '회원09',
      status: 'completed',
      assignedAdminLoginId: ME,
      receivedAt: day(2),
      events: [
        event(11, 'received', 'user', null, null, day(2)),
        event(12, 'status_changed', 'internal', null, ME, day(2, 5)),
      ],
      resolution: {
        outcome: 'no_action',
        userReply: null,
        accountActionId: null,
        contentAction: null,
        resolvedAt: day(2, 5),
      },
    }),
  ];

  // More inquiries, so that the list has a second page.
  const categories = ['계정', '결제', '오류', '기타'];
  for (let n = 1; n <= 22; n += 1) {
    const completed = n % 5 === 0;
    const inReview = !completed && n % 3 === 0;
    const receivedAt = day(8 + (n % 20), n % 24);
    tickets.push(
      ticket({
        id: uuid('e', 10 + n),
        ticketType: 'inquiry',
        category: categories[n % categories.length],
        subject: `문의 ${n}`,
        body: `문의 내용 ${n}`,
        reporterNickname: `회원${String(30 + n).padStart(2, '0')}`,
        status: completed ? 'completed' : inReview ? 'in_review' : 'received',
        assignedAdminLoginId: completed || inReview ? (n % 2 ? ME : 'other_admin') : null,
        receivedAt,
      }),
    );
  }
  return tickets;
}

const REPLY_MAX = 2000; // M23 `body` is 1~2000 characters
const OUTCOMES = ['no_action', 'reply_only', 'account_action', 'content_action', 'both'];
const validationFailed = () =>
  errorResponse(400, 'COMMON_VALIDATION_FAILED', '입력한 내용을 다시 확인해 주세요.');
const notFound = () => errorResponse(404, 'COMMON_NOT_FOUND', '찾을 수 없어요.');

/** Whether the fields of a TicketResolutionInput fit its `outcome` (docs/07 TicketResolutionInput). */
function resolutionIsValid(ticketType, body) {
  const { outcome, userReply, accountAction, contentAction } = body;
  if (!OUTCOMES.includes(outcome)) return false;
  if (ticketType === 'inquiry' && outcome !== 'reply_only') return false;
  const needsAccount = outcome === 'account_action' || outcome === 'both';
  const needsContent = outcome === 'content_action' || outcome === 'both';
  if (outcome === 'reply_only' && !userReply?.trim()) return false;
  if (Boolean(accountAction) !== needsAccount) return false;
  if (Boolean(contentAction) !== needsContent) return false;
  if (accountAction) {
    const { actionType, days, reason } = accountAction;
    if (!['warning', 'restriction'].includes(actionType) || !reason?.trim()) return false;
    if (actionType === 'restriction' && !(Number.isInteger(days) && days >= 1 && days <= 365)) {
      return false;
    }
  }
  return !contentAction || ['hidden', 'deleted'].includes(contentAction);
}

/** Fresh handlers with their own data. `handlers` below uses one set for the dev server. */
export function createHandlers() {
  const tickets = seedTickets();
  let eventCount = 100;
  let actionCount = 0;

  const addEvent = (target, eventType, visibility, body) => {
    eventCount += 1;
    target.events.push(event(eventCount, eventType, visibility, body, ME, nowIso()));
  };
  // docs/11 §3.5: the first assignment or answer moves "received" to "in_review".
  const startReview = (target) => {
    if (target.status !== 'received') return;
    target.status = 'in_review';
    target.assignedAdminLoginId = ME;
    addEvent(target, 'status_changed', 'internal', null);
  };
  const asListItem = (target) => {
    const sameTargetOpenCount = target.targetId
      ? tickets.filter(
          (other) =>
            other.ticketType === 'report' &&
            other.targetId === target.targetId &&
            other.status !== 'completed',
        ).length
      : 0;
    return {
      id: target.id,
      ticketType: target.ticketType,
      category: target.category,
      subject: target.subject,
      reporterNickname: target.reporterNickname,
      targetKind: target.targetKind,
      targetId: target.targetId,
      targetSummary: target.targetSummary,
      status: target.status,
      assignedAdminLoginId: target.assignedAdminLoginId,
      sameTargetOpenCount,
      receivedAt: target.receivedAt,
    };
  };
  const asDetail = (target) => ({
    ...asListItem(target),
    body: target.body,
    events: target.events,
    resolution: target.resolution,
  });

  return [
    mswHttp.get(`${BASE}/support-tickets`, async ({ request }) => {
      await delay(150);
      const { searchParams } = new URL(request.url);
      const ticketType = searchParams.get('ticketType');
      const status = searchParams.get('status');
      const targetKind = searchParams.get('targetKind');
      const assigned = searchParams.get('assigned');
      const items = tickets
        .filter((entry) => !ticketType || entry.ticketType === ticketType)
        .filter((entry) => !status || entry.status === status)
        .filter((entry) => !targetKind || entry.targetKind === targetKind)
        .filter(
          (entry) =>
            !assigned ||
            (assigned === 'me'
              ? entry.assignedAdminLoginId === ME
              : entry.assignedAdminLoginId === null),
        )
        .map(asListItem);
      return HttpResponse.json(
        paginate(sortItems(items, searchParams.get('sort') ?? 'receivedAt,asc'), searchParams),
      );
    }),

    mswHttp.get(`${BASE}/support-tickets/:ticketId`, async ({ params }) => {
      await delay(100);
      const target = tickets.find((entry) => entry.id === params.ticketId);
      return target ? HttpResponse.json(asDetail(target)) : notFound();
    }),

    mswHttp.post(`${BASE}/support-tickets/:ticketId/assign`, async ({ params, request }) => {
      const body = await request.json();
      const invalid = checkChange(request, body);
      if (invalid) return invalid;
      const target = tickets.find((entry) => entry.id === params.ticketId);
      if (!target) return notFound();
      target.assignedAdminLoginId = body.adminId ? `admin_${body.adminId.slice(0, 8)}` : ME;
      addEvent(target, 'assigned', 'internal', null);
      startReview(target);
      return HttpResponse.json(asDetail(target));
    }),

    mswHttp.post(`${BASE}/support-tickets/:ticketId/events`, async ({ params, request }) => {
      const body = await request.json();
      const invalid = checkChange(request, body);
      if (invalid) return invalid;
      const target = tickets.find((entry) => entry.id === params.ticketId);
      if (!target) return notFound();
      const text = typeof body.body === 'string' ? body.body.trim() : '';
      if (!['reply', 'note'].includes(body.eventType) || !text || text.length > REPLY_MAX) {
        return validationFailed();
      }
      startReview(target);
      addEvent(target, body.eventType, body.eventType === 'reply' ? 'user' : 'internal', text);
      return HttpResponse.json(asDetail(target), { status: 201 });
    }),

    mswHttp.post(`${BASE}/support-tickets/:ticketId/resolution`, async ({ params, request }) => {
      const body = await request.json();
      const invalid = checkChange(request, body);
      if (invalid) return invalid;
      const target = tickets.find((entry) => entry.id === params.ticketId);
      if (!target) return notFound();
      if (target.status === 'completed') {
        return errorResponse(409, 'ADMIN_STATE_CONFLICT', '지금 상태에서는 할 수 없는 작업이에요.');
      }
      if (!resolutionIsValid(target.ticketType, body)) return validationFailed();
      startReview(target);
      actionCount += 1;
      target.resolution = {
        outcome: body.outcome,
        userReply: body.userReply?.trim() || null,
        accountActionId: body.accountAction ? uuid('b', 50 + actionCount) : null,
        contentAction: body.contentAction ?? null,
        resolvedAt: nowIso(),
      };
      target.status = 'completed';
      addEvent(target, 'status_changed', 'internal', null);
      return HttpResponse.json(asDetail(target));
    }),
  ];
}

export const handlers = createHandlers();
