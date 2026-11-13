import { delay, http as mswHttp, HttpResponse } from 'msw';
import { BASE, checkChange, errorResponse, paginate, sortItems } from '../../mocks/helpers.js';

// MSW handlers for M10~M16 (docs/09 §3). The data lives in memory: a change made on one screen
// is seen on the others until the page is reloaded.

const uuid = (kind, n) => `${kind}4${String(n).padStart(6, '0')}`;

/** IDs of the fixed records that tests and demos can rely on. */
export const SEED_IDS = {
  plainUser: uuid('a', 1), // active, no restriction
  restrictedUser: uuid('a', 2), // has a restriction that is in force
  withdrawingUser: uuid('a', 3), // withdrawal_processing
  restrictionAction: uuid('b', 1),
  requestedWithdrawal: uuid('c', 1), // requested
  completedWithdrawal: uuid('c', 2), // completed
};

const FAR_FUTURE = '2099-12-31T00:00:00.000Z';
const nowIso = () => new Date().toISOString();

function seedUsers() {
  const users = Array.from({ length: 45 }, (_, index) => {
    const n = index + 1;
    return {
      id: uuid('a', n),
      nickname: `회원${String(n).padStart(2, '0')}`,
      maskedPhoneNumber: `010-****-${String(1000 + n)}`,
      maskedEmail: `u***@example.com`,
      status: 'active',
      createdAt: new Date(Date.UTC(2026, 9, 1 + (n % 28), 3, 0, 0)).toISOString(),
      providers: n % 2 ? ['phone'] : ['phone', 'kakao'],
      availablePoints: 100 * n,
      levelNo: 1 + (n % 7),
      streakDays: n % 12,
      goalCount: n % 5,
      completedMissionCount: 3 * n,
      lastActivityAt: n % 9 === 0 ? null : new Date(Date.UTC(2026, 10, 10, 1, n, 0)).toISOString(),
    };
  });
  users[2].status = 'withdrawal_processing';
  users[2].nickname = null;
  return users;
}

function seedActions() {
  return [
    {
      id: SEED_IDS.restrictionAction,
      userId: SEED_IDS.restrictedUser,
      actionType: 'restriction',
      reason: '반복 부정 인증',
      startsAt: '2026-11-01T00:00:00.000Z',
      endsAt: FAR_FUTURE,
      liftedAt: null,
      adminLoginId: 'dev_admin',
      createdAt: '2026-11-01T00:00:00.000Z',
    },
  ];
}

function seedWithdrawals() {
  const scope = { deleteCount: 42, anonymizeCount: 1, retainCount: 0 };
  return [
    {
      id: SEED_IDS.requestedWithdrawal,
      userId: SEED_IDS.withdrawingUser,
      nickname: null,
      status: 'requested',
      requestedAt: '2026-11-09T02:00:00.000Z',
      reviewedAt: null,
      reason: null,
      completedAt: null,
      dataScope: scope,
    },
    {
      id: SEED_IDS.completedWithdrawal,
      userId: null,
      nickname: null,
      status: 'completed',
      requestedAt: '2026-11-02T02:00:00.000Z',
      reviewedAt: '2026-11-03T02:00:00.000Z',
      reason: null,
      completedAt: '2026-11-04T02:00:00.000Z',
      dataScope: { deleteCount: 10, anonymizeCount: 0, retainCount: 0 },
    },
    {
      id: uuid('c', 3),
      userId: uuid('a', 20),
      nickname: '회원20',
      status: 'on_hold',
      requestedAt: '2026-11-08T02:00:00.000Z',
      reviewedAt: '2026-11-09T02:00:00.000Z',
      reason: '미처리 신고 확인 중',
      completedAt: null,
      dataScope: scope,
    },
  ];
}

// The transitions of docs/11 §3.6 that M16 can do.
const WITHDRAWAL_TRANSITIONS = { on_hold: ['requested'], processing: ['requested', 'on_hold'] };

const activeRestriction = (actions, userId) =>
  actions.find(
    (action) =>
      action.userId === userId &&
      action.actionType === 'restriction' &&
      !action.liftedAt &&
      action.startsAt <= nowIso() &&
      nowIso() < action.endsAt,
  );

/** Fresh handlers with their own data. `handlers` below uses one set for the dev server. */
export function createHandlers() {
  const users = seedUsers();
  const actions = seedActions();
  const withdrawals = seedWithdrawals();

  const asListItem = (user) => {
    const restriction = activeRestriction(actions, user.id);
    return {
      id: user.id,
      nickname: user.nickname,
      maskedPhoneNumber: user.maskedPhoneNumber,
      maskedEmail: user.maskedEmail,
      status: user.status,
      restriction: restriction ? { actionId: restriction.id, endsAt: restriction.endsAt } : null,
      createdAt: user.createdAt,
    };
  };
  const notFound = () => errorResponse(404, 'COMMON_NOT_FOUND', '찾을 수 없어요.');

  return [
    mswHttp.get(`${BASE}/users`, async ({ request }) => {
      await delay(150);
      const { searchParams } = new URL(request.url);
      const query = searchParams.get('query');
      const status = searchParams.get('status');
      const restricted = searchParams.get('restricted');
      const joinedFrom = searchParams.get('joinedFrom');
      const joinedTo = searchParams.get('joinedTo');
      const items = users
        .map(asListItem)
        .filter((user) => !query || user.id === query || user.nickname?.includes(query))
        .filter((user) => !status || user.status === status)
        .filter((user) => !restricted || Boolean(user.restriction) === (restricted === 'true'))
        .filter((user) => !joinedFrom || user.createdAt.slice(0, 10) >= joinedFrom)
        .filter((user) => !joinedTo || user.createdAt.slice(0, 10) <= joinedTo);
      return HttpResponse.json(
        paginate(sortItems(items, searchParams.get('sort') ?? 'createdAt,desc'), searchParams),
      );
    }),

    mswHttp.get(`${BASE}/users/:userId`, async ({ params }) => {
      await delay(100);
      const user = users.find((entry) => entry.id === params.userId);
      if (!user) return notFound();
      const { providers, availablePoints, levelNo, streakDays, goalCount } = user;
      const { completedMissionCount, lastActivityAt } = user;
      return HttpResponse.json({
        ...asListItem(user),
        providers,
        availablePoints,
        levelNo,
        streakDays,
        goalCount,
        completedMissionCount,
        lastActivityAt,
        accountActions: actions.filter((action) => action.userId === user.id).slice(0, 10),
      });
    }),

    mswHttp.get(`${BASE}/users/:userId/activities`, async ({ params, request }) => {
      await delay(100);
      if (!users.some((entry) => entry.id === params.userId)) return notFound();
      const { searchParams } = new URL(request.url);
      const type = searchParams.get('type');
      const all = Array.from({ length: 30 }, (_, index) => {
        const kinds = ['verification', 'report', 'point', 'inquiry'];
        const kind = kinds[index % kinds.length];
        return {
          occurredAt: new Date(Date.UTC(2026, 10, 11, 5, 59 - index, 0)).toISOString(),
          type: kind,
          targetId: uuid('d', index + 1),
          summary: `${kind} 활동 ${index + 1}`,
          result: kind === 'point' ? '+100 P' : '검수 대기',
        };
      });
      return HttpResponse.json(
        paginate(
          all.filter((a) => !type || a.type === type),
          searchParams,
        ),
      );
    }),

    mswHttp.post(`${BASE}/users/:userId/account-actions`, async ({ params, request }) => {
      const body = await request.json();
      const invalid = checkChange(request, body);
      if (invalid) return invalid;
      const user = users.find((entry) => entry.id === params.userId);
      if (!user) return notFound();
      if (body.actionType === 'restriction' && activeRestriction(actions, user.id)) {
        return errorResponse(409, 'ADMIN_ACTION_CONFLICT', '이미 진행 중인 이용 제한이 있어요.');
      }
      const startsAt = nowIso();
      const action = {
        id: uuid('b', actions.length + 1),
        userId: user.id,
        actionType: body.actionType,
        reason: body.reason,
        startsAt,
        endsAt:
          body.actionType === 'restriction'
            ? new Date(Date.now() + body.days * 24 * 3600 * 1000).toISOString()
            : null,
        liftedAt: null,
        adminLoginId: 'dev_admin',
        createdAt: startsAt,
      };
      actions.unshift(action);
      return HttpResponse.json(action, { status: 201 });
    }),

    mswHttp.post(`${BASE}/account-actions/:actionId/lift`, async ({ params, request }) => {
      const body = await request.json();
      const invalid = checkChange(request, body);
      if (invalid) return invalid;
      const action = actions.find((entry) => entry.id === params.actionId);
      if (!action) return notFound();
      action.liftedAt = nowIso();
      return HttpResponse.json(action);
    }),

    mswHttp.get(`${BASE}/withdrawal-requests`, async ({ request }) => {
      await delay(150);
      const { searchParams } = new URL(request.url);
      const status = searchParams.get('status');
      const items = withdrawals.filter((entry) => !status || entry.status === status);
      return HttpResponse.json(
        paginate(sortItems(items, searchParams.get('sort') ?? 'requestedAt,asc'), searchParams),
      );
    }),

    mswHttp.patch(`${BASE}/withdrawal-requests/:requestId`, async ({ params, request }) => {
      const body = await request.json();
      const invalid = checkChange(request, body);
      if (invalid) return invalid;
      const entry = withdrawals.find((item) => item.id === params.requestId);
      if (!entry) return notFound();
      if (!WITHDRAWAL_TRANSITIONS[body.status]?.includes(entry.status)) {
        return errorResponse(409, 'ADMIN_STATE_CONFLICT', '지금 상태에서는 할 수 없는 작업이에요.');
      }
      entry.status = body.status;
      entry.reviewedAt = nowIso();
      if (body.status === 'on_hold') entry.reason = body.reason;
      return HttpResponse.json(entry);
    }),
  ];
}

export const handlers = createHandlers();
