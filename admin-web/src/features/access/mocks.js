import { delay, http as mswHttp, HttpResponse } from 'msw';
import { BASE, paginate, sortItems } from '../../mocks/helpers.js';

// MSW handlers for M101 (docs/09 §10). The log is read-only; the data is generated once.

const uuid = (n) => `a4${String(n).padStart(6, '0')}`;

/** IDs of the fixed logs that tests and demos can rely on. */
export const SEED_IDS = {
  liftRestriction: 'c4000001', // has before and after values
  failedPublish: 'c4000002', // result failure
  noValues: 'c4000003', // no before/after
};

const STEP = 60 * 60 * 1000;
const BASE_TIME = Date.UTC(2026, 9, 20, 0, 0, 0); // 2026-10-20 00:00 UTC

const log = (n, fields) => ({
  targetUserId: null,
  result: 'success',
  reason: null,
  beforeValue: null,
  afterValue: null,
  recordedAt: new Date(BASE_TIME - n * STEP).toISOString(),
  ...fields,
});

// Actions of docs/09 with the admin that did them, so that the prefix filter has something to show.
const GENERATED = [
  ['dev_admin', 'verification.decide', 5],
  ['dev_admin', 'ticket.reply', 7],
  ['other_admin', 'ticket.resolve', 3],
  ['other_admin', 'notice.publish', null],
  ['dev_admin', 'mission_definition.create', null],
  ['dev_admin', 'account_action.create', 2],
];

function seedLogs() {
  const logs = [
    log(0, {
      id: SEED_IDS.liftRestriction,
      adminLoginId: 'dev_admin',
      action: 'account_action.lift',
      targetUserId: uuid(3),
      reason: '오해로 인한 제한이라 해제해요',
      beforeValue: { liftedAt: null },
      afterValue: { liftedAt: '2026-10-20T00:00:00.000Z' },
    }),
    log(1, {
      id: SEED_IDS.failedPublish,
      adminLoginId: 'other_admin',
      action: 'notice.publish',
      result: 'failure',
      reason: '바로 게시',
    }),
    log(2, {
      id: SEED_IDS.noValues,
      adminLoginId: 'dev_admin',
      action: 'ticket.assign',
      reason: '제가 맡을게요',
    }),
  ];
  for (let n = 0; n < 42; n += 1) {
    const [adminLoginId, action, user] = GENERATED[n % GENERATED.length];
    logs.push(
      log(3 + n, {
        id: `c4${String(100 + n).padStart(6, '0')}`,
        adminLoginId,
        action,
        targetUserId: user ? uuid(user) : null,
        reason: `생성된 기록 ${n + 1}`,
      }),
    );
  }
  return logs;
}

const startOfDay = (date) => Date.parse(`${date}T00:00:00+09:00`);
const endOfDay = (date) => Date.parse(`${date}T23:59:59.999+09:00`);

export const handlers = [
  // M101
  mswHttp.get(`${BASE}/audit-logs`, async ({ request }) => {
    await delay(30);
    const query = new URL(request.url).searchParams;
    const adminId = query.get('adminId');
    const action = query.get('action');
    const targetUserId = query.get('targetUserId');
    const result = query.get('result');
    const from = query.get('from');
    const to = query.get('to');
    const items = seedLogs().filter(
      (item) =>
        (!adminId || item.adminLoginId === adminId) &&
        (!action || item.action.startsWith(action)) &&
        (!targetUserId || item.targetUserId === targetUserId) &&
        (!result || item.result === result) &&
        (!from || Date.parse(item.recordedAt) >= startOfDay(from)) &&
        (!to || Date.parse(item.recordedAt) <= endOfDay(to)),
    );
    // Without a sort the newest log comes first (docs/09 M101).
    return HttpResponse.json(
      paginate(sortItems(items, query.get('sort') ?? 'recordedAt,desc'), query),
    );
  }),
];
