import { delay, http as mswHttp, HttpResponse } from 'msw';
import { BASE, checkChange, errorResponse, paginate } from '../../mocks/helpers.js';

// MSW handlers for M90~M100 (docs/09 §9). The data lives in memory: a change made on one screen
// is seen on the others until the page is reloaded.

const uuid = (kind, n) => `${kind}4${String(n).padStart(6, '0')}`;

/** IDs of the fixed rows that tests and demos can rely on. */
export const SEED_IDS = {
  draftNotice: uuid('a', 1), // service, draft, no push
  draftPolicyNotice: uuid('a', 2), // policy, draft, push, points to publishedPolicy
  scheduledNotice: uuid('a', 3),
  publishedNotice: uuid('a', 4), // push, has push stats
  cancelledNotice: uuid('a', 5),
  publishedPolicy: uuid('b', 1), // terms v1
  unpublishedPolicy: uuid('b', 2), // terms v2
  activeMessage: uuid('c', 1), // always
  inactiveMessage: uuid('c', 2), // time_slot
};

const NOTICE_CATEGORIES = ['service', 'event', 'policy', 'marketing'];
const CONDITION_TYPES = [
  'always',
  'no_mission_today',
  'streak_at_risk',
  'inactive_days',
  'time_slot',
];
const LINK_SCREEN = /^[a-z][A-Za-z0-9_/.-]*$/;
const ID_FORMAT = /^[0-9A-Za-z]{8}$/;

const nowIso = () => new Date().toISOString();
const day = (n, hour = 1) => new Date(Date.UTC(2026, 9, n, hour, 0, 0)).toISOString();
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString();

const zeroStats = () => ({ pending: 0, sent: 0, failed: 0, skipped: 0 });

function notice(fields) {
  return {
    linkScreen: null,
    audienceType: 'all',
    userIds: [],
    showInList: true,
    sendPush: false,
    policyDocumentVersionId: null,
    status: 'draft',
    scheduledAt: null,
    publishedAt: null,
    cancelledAt: null,
    pushStats: zeroStats(),
    ...fields,
  };
}

function seedNotices() {
  return [
    notice({
      id: SEED_IDS.draftNotice,
      category: 'service',
      title: '서비스 점검 안내',
      body: '11월 20일 새벽 2시부터 4시까지 점검이 있어요.',
    }),
    notice({
      id: SEED_IDS.draftPolicyNotice,
      category: 'policy',
      title: '이용약관이 바뀌어요',
      body: '새 이용약관을 확인해 주세요.',
      sendPush: true,
      linkScreen: 'home',
      policyDocumentVersionId: SEED_IDS.publishedPolicy,
    }),
    notice({
      id: SEED_IDS.scheduledNotice,
      category: 'event',
      title: '가을 챌린지 이벤트',
      body: '11월 한 달 동안 챌린지에 참여해 보세요.',
      status: 'scheduled',
      scheduledAt: inDays(3),
      showInList: true,
    }),
    notice({
      id: SEED_IDS.publishedNotice,
      category: 'service',
      title: '새 기능이 추가됐어요',
      body: '펫 진화 화면이 새로워졌어요.',
      sendPush: true,
      status: 'published',
      publishedAt: day(1),
      pushStats: { pending: 2, sent: 120, failed: 3, skipped: 15 },
    }),
    notice({
      id: SEED_IDS.cancelledNotice,
      category: 'marketing',
      title: '친구 초대 혜택',
      body: '친구를 초대하면 포인트를 드려요.',
      status: 'cancelled',
      cancelledAt: day(2),
    }),
  ];
}

const policy = (fields) => ({ requiresReconsent: false, publishedAt: null, ...fields });

function seedPolicies() {
  return [
    policy({
      id: SEED_IDS.publishedPolicy,
      documentType: 'terms',
      version: '1.0',
      body: '제1조 (목적) 이 약관은 D-World 서비스 이용 조건을 정해요.',
      effectiveAt: day(1),
      publishedAt: day(1),
    }),
    policy({
      id: SEED_IDS.unpublishedPolicy,
      documentType: 'terms',
      version: '1.1',
      body: '제1조 (목적) 개정된 이용 약관이에요.',
      effectiveAt: inDays(14),
      requiresReconsent: true,
    }),
    policy({
      id: uuid('b', 3),
      documentType: 'privacy',
      version: '1.0',
      body: '개인정보 처리방침 본문이에요.',
      effectiveAt: day(1),
      publishedAt: day(1),
    }),
    policy({
      id: uuid('b', 4),
      documentType: 'marketing',
      version: '1.0',
      body: '마케팅 수신 동의 본문이에요.',
      effectiveAt: day(1),
      publishedAt: day(1),
    }),
  ];
}

const message = (fields) => ({
  conditionParams: {},
  categoryCode: null,
  priority: 50,
  startsAt: null,
  endsAt: null,
  isActive: true,
  ...fields,
});

function seedMessages() {
  return [
    message({
      id: SEED_IDS.activeMessage,
      message: '오늘도 작은 미션 하나부터 시작해 볼까요?',
      conditionType: 'always',
    }),
    message({
      id: SEED_IDS.inactiveMessage,
      message: '아침 운동으로 하루를 시작해요!',
      conditionType: 'time_slot',
      conditionParams: { startHour: 6, endHour: 9 },
      categoryCode: 'exercise',
      priority: 70,
      isActive: false,
    }),
    message({
      id: uuid('c', 3),
      message: '3일째 쉬고 있어요. 가볍게 다시 시작해요.',
      conditionType: 'inactive_days',
      conditionParams: { days: 3 },
      priority: 80,
    }),
  ];
}

// The input of a change: the body without the `reason` of the audit log.
function withoutReason(body) {
  const input = { ...body };
  delete input.reason;
  return input;
}

const validation = () =>
  errorResponse(400, 'COMMON_VALIDATION_FAILED', '입력한 내용을 다시 확인해 주세요.');
const notFound = () => errorResponse(404, 'COMMON_NOT_FOUND', '찾을 수 없어요.');
const stateConflict = () =>
  errorResponse(409, 'ADMIN_STATE_CONFLICT', '지금 상태에서는 할 수 없는 작업이에요.');

const isText = (value, max) =>
  typeof value === 'string' && value.trim().length >= 1 && value.length <= max;

function noticeInputIsValid(input) {
  if (!NOTICE_CATEGORIES.includes(input.category)) return false;
  if (!isText(input.title, 100) || !isText(input.body, 5000)) return false;
  if (input.linkScreen && !LINK_SCREEN.test(input.linkScreen)) return false;
  if (!['all', 'users'].includes(input.audienceType)) return false;
  if (input.audienceType === 'users') {
    if (!Array.isArray(input.userIds) || input.userIds.length === 0) return false;
    if (!input.userIds.every((id) => ID_FORMAT.test(id))) return false;
  }
  if (typeof input.showInList !== 'boolean' || typeof input.sendPush !== 'boolean') return false;
  if (input.category === 'policy' && !input.policyDocumentVersionId) return false;
  return true;
}

function policyInputIsValid(input) {
  return (
    ['terms', 'privacy', 'marketing'].includes(input.documentType) &&
    isText(input.version, 20) &&
    isText(input.body, 100000) &&
    Boolean(input.effectiveAt) &&
    typeof input.requiresReconsent === 'boolean'
  );
}

function messageInputIsValid(input) {
  if (!isText(input.message, 200) || !CONDITION_TYPES.includes(input.conditionType)) return false;
  if (!Number.isInteger(input.priority) || input.priority < 0 || input.priority > 100) return false;
  if (typeof input.isActive !== 'boolean') return false;
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) return false;
  const params = input.conditionParams ?? {};
  if (input.conditionType === 'inactive_days') {
    return Number.isInteger(params.days) && params.days >= 1 && params.days <= 365;
  }
  if (input.conditionType === 'time_slot') {
    const { startHour, endHour } = params;
    const hourOk = (hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23;
    return hourOk(startHour) && hourOk(endHour) && startHour !== endHour;
  }
  return true;
}

/**
 * Fresh handlers with their own in-memory data. A test calls this for every test and passes the
 * result to `server.use(...)`, so that no test sees the changes of another.
 */
export function createHandlers() {
  const notices = seedNotices();
  const policies = seedPolicies();
  const messages = seedMessages();
  let counter = 1000;
  const nextId = (kind) => uuid(kind, ++counter);

  // The body of a change, read once: null when it is not JSON.
  const readBody = (request) => request.json().catch(() => null);

  return [
    // M90
    mswHttp.get(`${BASE}/notices`, async ({ request }) => {
      await delay(30);
      const query = new URL(request.url).searchParams;
      const status = query.get('status');
      const category = query.get('category');
      const items = notices.filter(
        (item) => (!status || item.status === status) && (!category || item.category === category),
      );
      return HttpResponse.json(paginate(items, query));
    }),
    // M91
    mswHttp.post(`${BASE}/notices`, async ({ request }) => {
      const body = await readBody(request);
      const invalid = checkChange(request, body);
      if (invalid) return invalid;
      if (!noticeInputIsValid(body)) return validation();
      const input = withoutReason(body);
      const created = notice({
        ...input,
        id: nextId('a'),
        linkScreen: input.linkScreen || null,
        userIds: input.audienceType === 'users' ? input.userIds : [],
        policyDocumentVersionId: input.policyDocumentVersionId ?? null,
        scheduledAt: input.scheduledAt ?? null,
        status: 'draft',
      });
      notices.unshift(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    // M92
    mswHttp.patch(`${BASE}/notices/:noticeId`, async ({ request, params }) => {
      const body = await readBody(request);
      const invalid = checkChange(request, body);
      if (invalid) return invalid;
      const target = notices.find((item) => item.id === params.noticeId);
      if (!target) return notFound();
      if (target.status !== 'draft') return stateConflict();
      if (!noticeInputIsValid(body)) return validation();
      const input = withoutReason(body);
      Object.assign(target, input, {
        linkScreen: input.linkScreen || null,
        userIds: input.audienceType === 'users' ? input.userIds : [],
        policyDocumentVersionId: input.policyDocumentVersionId ?? null,
        scheduledAt: input.scheduledAt ?? null,
      });
      return HttpResponse.json(target);
    }),
    // M93
    mswHttp.post(`${BASE}/notices/:noticeId/publish`, async ({ request, params }) => {
      const body = await readBody(request);
      const invalid = checkChange(request, body);
      if (invalid) return invalid;
      const target = notices.find((item) => item.id === params.noticeId);
      if (!target) return notFound();
      if (target.status !== 'draft') return stateConflict();
      const scheduledAt = body.scheduledAt ?? null;
      if (scheduledAt) {
        if (Number.isNaN(Date.parse(scheduledAt)) || Date.parse(scheduledAt) <= Date.now()) {
          return validation();
        }
        Object.assign(target, { status: 'scheduled', scheduledAt });
      } else {
        Object.assign(target, {
          status: 'published',
          scheduledAt: null,
          publishedAt: nowIso(),
          pushStats: target.sendPush
            ? { pending: 12, sent: 0, failed: 0, skipped: 0 }
            : zeroStats(),
        });
      }
      return HttpResponse.json(target);
    }),
    // M94
    mswHttp.post(`${BASE}/notices/:noticeId/cancel`, async ({ request, params }) => {
      const body = await readBody(request);
      const invalid = checkChange(request, body);
      if (invalid) return invalid;
      const target = notices.find((item) => item.id === params.noticeId);
      if (!target) return notFound();
      if (!['draft', 'scheduled'].includes(target.status)) return stateConflict();
      Object.assign(target, { status: 'cancelled', cancelledAt: nowIso() });
      return HttpResponse.json(target);
    }),
    // M95
    mswHttp.get(`${BASE}/policy-documents`, async ({ request }) => {
      await delay(30);
      return HttpResponse.json(paginate(policies, new URL(request.url).searchParams));
    }),
    // M96
    mswHttp.post(`${BASE}/policy-documents`, async ({ request }) => {
      const body = await readBody(request);
      const invalid = checkChange(request, body);
      if (invalid) return invalid;
      if (!policyInputIsValid(body)) return validation();
      const input = withoutReason(body);
      // The same type and version is a conflict (a version is written once).
      if (
        policies.some((p) => p.documentType === input.documentType && p.version === input.version)
      ) {
        return stateConflict();
      }
      const created = policy({ ...input, id: nextId('b') });
      policies.unshift(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    // M97
    mswHttp.post(`${BASE}/policy-documents/:versionId/publish`, async ({ request, params }) => {
      const body = await readBody(request);
      const invalid = checkChange(request, body);
      if (invalid) return invalid;
      const target = policies.find((item) => item.id === params.versionId);
      if (!target) return notFound();
      if (target.publishedAt) return stateConflict();
      target.publishedAt = nowIso();
      return HttpResponse.json(target);
    }),
    // M98
    mswHttp.get(`${BASE}/recommendation-messages`, async ({ request }) => {
      await delay(30);
      return HttpResponse.json(paginate(messages, new URL(request.url).searchParams));
    }),
    // M99
    mswHttp.post(`${BASE}/recommendation-messages`, async ({ request }) => {
      const body = await readBody(request);
      const invalid = checkChange(request, body);
      if (invalid) return invalid;
      if (!messageInputIsValid(body)) return validation();
      const input = withoutReason(body);
      const created = message({ ...input, id: nextId('c') });
      messages.unshift(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    // M100
    mswHttp.patch(`${BASE}/recommendation-messages/:messageId`, async ({ request, params }) => {
      const body = await readBody(request);
      const invalid = checkChange(request, body);
      if (invalid) return invalid;
      const target = messages.find((item) => item.id === params.messageId);
      if (!target) return notFound();
      if (!messageInputIsValid(body)) return validation();
      const input = withoutReason(body);
      Object.assign(target, input);
      return HttpResponse.json(target);
    }),
  ];
}

export const handlers = createHandlers();
