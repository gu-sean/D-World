import { delay, http as mswHttp, HttpResponse } from 'msw';

// MSW handlers for the reward screens (ADM-22~27). Used with VITE_USE_MSW=true, no backend needed.
// Shapes follow the backend controllers; data is kept in memory and resets on reload.
const BASE = import.meta.env.VITE_ADMIN_API_BASE_URL ?? '/admin/v1';

const errorResponse = (status, code, message) =>
  HttpResponse.json({ error: { code, message, details: null } }, { status });

const id = () => crypto.randomUUID();
const omit = (obj, ...keys) =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
const past = (days) => new Date(Date.now() - days * 86_400_000).toISOString();
const nowIso = () => new Date().toISOString();

// ---- catalogs ----
const categories = [
  {
    id: 'c0000000-0000-4000-8000-000000000001',
    code: 'exercise',
    name: '운동',
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'c0000000-0000-4000-8000-000000000002',
    code: 'study',
    name: '공부',
    displayOrder: 2,
    isActive: true,
  },
];
const difficulties = [
  {
    id: 'd0000000-0000-4000-8000-000000000001',
    code: 'easy',
    name: '쉬움',
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'd0000000-0000-4000-8000-000000000002',
    code: 'hard',
    name: '어려움',
    displayOrder: 2,
    isActive: true,
  },
];

// ---- points ----
const USER = 'a0000000-0000-4000-8000-000000000001';
const transactions = [
  {
    id: id(),
    userId: USER,
    kind: 'auto_award',
    availableDelta: 50,
    outstandingDelta: 0,
    balanceAfter: 150,
    outstandingAfter: 0,
    sourceType: 'mission',
    sourceId: id(),
    reason: null,
    createdByAdminId: null,
    occurredAt: past(2),
  },
  {
    id: id(),
    userId: USER,
    kind: 'spend',
    availableDelta: -30,
    outstandingDelta: 0,
    balanceAfter: 120,
    outstandingAfter: 0,
    sourceType: 'shop_order',
    sourceId: id(),
    reason: null,
    createdByAdminId: null,
    occurredAt: past(1),
  },
];
let balance = 120;

// ---- policies ----
const caps = [{ id: id(), effectiveMonth: '2026-11-01', monthlyLimitPoints: 5000 }];
const rates = [
  {
    id: id(),
    categoryId: categories[0].id,
    difficultyId: difficulties[0].id,
    versionNo: 1,
    points: 10,
    userXp: 10,
    petXp: 5,
    effectiveAt: past(30),
  },
];
const streaks = STREAKS();
function STREAKS() {
  return [7, 30, 100].map((days, index) => ({
    id: id(),
    targetSuccessDays: days,
    versionNo: 1,
    points: [20, 100, 500][index],
    userXp: [20, 100, 500][index],
    petXp: [10, 50, 250][index],
    effectiveAt: past(30),
  }));
}
const petLevels = [
  {
    id: id(),
    versionNo: 1,
    effectiveAt: past(30),
    thresholds: [
      { levelNo: 1, minTotalXp: 0 },
      { levelNo: 2, minTotalXp: 100 },
      { levelNo: 3, minTotalXp: 300 },
    ],
  },
];

// ---- achievements and species ----
const achievements = [];
const species = [];

const withVersion = (list, kind, body, paramId) => {
  let item = paramId ? list.find((x) => x.id === paramId) : null;
  if (paramId && !item) return errorResponse(404, 'COMMON_NOT_FOUND', '찾을 수 없어요.');
  if (item?.status === 'hidden')
    return errorResponse(409, 'ADMIN_STATE_CONFLICT', '숨긴 항목은 고칠 수 없어요.');
  if (!item) {
    item = {
      id: body.ownerId ?? id(),
      code: body.code,
      status: body.status,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      currentVersionNo: null,
      versions: [],
    };
    list.push(item);
  }
  const fields = omit(body, 'code', 'reason');
  const versionNo = item.versions.length + 1;
  item.versions.push(
    kind === 'achievement'
      ? { versionNo, ...fields, badgeImageUrl: 'https://placehold.co/80', createdAt: nowIso() }
      : {
          versionNo,
          ...fields,
          stages: fields.stages.map((s) => ({
            ...s,
            stageCode: ['egg', 'baby', 'adult'][s.stageNo - 1],
            imageUrl: 'https://placehold.co/80',
          })),
        },
  );
  item.status = body.status;
  const current = item.versions.filter((v) => new Date(v.effectiveAt) <= new Date()).at(-1);
  item.currentVersionNo = current?.versionNo ?? null;
  return HttpResponse.json(item, { status: 201 });
};

export const handlers = [
  mswHttp.get(`${BASE}/goal-categories`, () => HttpResponse.json(categories)),
  mswHttp.get(`${BASE}/difficulty-levels`, () => HttpResponse.json(difficulties)),

  mswHttp.get(`${BASE}/point-transactions`, async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const kind = url.searchParams.get('kind');
    const userId = url.searchParams.get('userId');
    const rows = transactions
      .filter((t) => (!kind || t.kind === kind) && (!userId || t.userId === userId))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return HttpResponse.json(
      { items: rows, page: 1, size: 20, totalCount: rows.length },
      { headers: { 'X-Pending-Points': '40' } },
    );
  }),

  mswHttp.post(`${BASE}/point-adjustments`, async ({ request }) => {
    await delay(300);
    const body = await request.json();
    const recovery = body.kind === 'manual_recovery';
    if (recovery && body.amount > balance) {
      return errorResponse(409, 'ADMIN_STATE_CONFLICT', '가용 잔액보다 많이 회수할 수 없어요.');
    }
    balance += recovery ? -body.amount : body.amount;
    const row = {
      id: id(),
      userId: body.userId,
      kind: body.kind,
      availableDelta: recovery ? -body.amount : body.amount,
      outstandingDelta: 0,
      balanceAfter: balance,
      outstandingAfter: 0,
      sourceType: 'admin_adjustment',
      sourceId: id(),
      reason: body.reason,
      createdByAdminId: id(),
      occurredAt: nowIso(),
    };
    transactions.push(row);
    return HttpResponse.json(row, { status: 201 });
  }),

  mswHttp.get(`${BASE}/point-cap-policies`, () => HttpResponse.json({ items: caps })),
  mswHttp.post(`${BASE}/point-cap-policies`, async ({ request }) => {
    const body = await request.json();
    const row = {
      id: id(),
      effectiveMonth: body.effectiveMonth,
      monthlyLimitPoints: body.monthlyLimitPoints,
    };
    caps.unshift(row);
    return HttpResponse.json(row, { status: 201 });
  }),

  mswHttp.get(`${BASE}/mission-reward-rates`, ({ request }) => {
    const url = new URL(request.url);
    const categoryId = url.searchParams.get('categoryId');
    const difficultyId = url.searchParams.get('difficultyId');
    return HttpResponse.json(
      rates.filter(
        (r) =>
          (!categoryId || r.categoryId === categoryId) &&
          (!difficultyId || r.difficultyId === difficultyId),
      ),
    );
  }),
  mswHttp.post(`${BASE}/mission-reward-rates`, async ({ request }) => {
    const body = omit(await request.json(), 'reason');
    const versionNo =
      rates.filter((r) => r.categoryId === body.categoryId && r.difficultyId === body.difficultyId)
        .length + 1;
    const row = { id: id(), versionNo, ...body, effectiveAt: body.effectiveAt ?? nowIso() };
    rates.push(row);
    return HttpResponse.json(row, { status: 201 });
  }),

  mswHttp.get(`${BASE}/streak-milestone-policies`, () => HttpResponse.json({ items: streaks })),
  mswHttp.post(`${BASE}/streak-milestone-policies`, async ({ request }) => {
    const body = omit(await request.json(), 'reason');
    if (![7, 30, 100].includes(body.targetSuccessDays)) {
      return errorResponse(
        400,
        'COMMON_VALIDATION',
        'targetSuccessDays: 7, 30, 100 중 하나여야 함',
      );
    }
    const versionNo =
      streaks.filter((s) => s.targetSuccessDays === body.targetSuccessDays).length + 1;
    const row = { id: id(), versionNo, ...body, effectiveAt: body.effectiveAt ?? nowIso() };
    streaks.push(row);
    return HttpResponse.json(row, { status: 201 });
  }),

  mswHttp.get(`${BASE}/policies/pet-levels`, () => HttpResponse.json({ items: petLevels })),
  mswHttp.post(`${BASE}/policies/pet-levels`, async ({ request }) => {
    const body = await request.json();
    const row = {
      id: id(),
      versionNo: petLevels.length + 1,
      thresholds: body.thresholds,
      effectiveAt: body.effectiveAt ?? nowIso(),
    };
    petLevels.push(row);
    return HttpResponse.json(row, { status: 201 });
  }),

  mswHttp.get(`${BASE}/achievements`, () => HttpResponse.json(achievements)),
  mswHttp.post(`${BASE}/achievements`, async ({ request }) =>
    withVersion(achievements, 'achievement', await request.json()),
  ),
  mswHttp.post(`${BASE}/achievements/:achievementId/versions`, async ({ request, params }) =>
    withVersion(achievements, 'achievement', await request.json(), params.achievementId),
  ),

  mswHttp.get(`${BASE}/pet-species`, () => HttpResponse.json(species)),
  mswHttp.post(`${BASE}/pet-species`, async ({ request }) =>
    withVersion(species, 'species', await request.json()),
  ),
  mswHttp.post(`${BASE}/pet-species/:speciesId/versions`, async ({ request, params }) =>
    withVersion(species, 'species', await request.json(), params.speciesId),
  ),

  // Image upload: the mock ticket points at a URL that this handler accepts.
  mswHttp.post(`${BASE}/assets/upload-urls`, async ({ request }) => {
    const body = await request.json();
    const assetId = id();
    return HttpResponse.json(
      {
        assetId,
        assetKind: body.assetKind,
        ownerId: body.ownerId,
        uploadUrl: `${BASE}/mock-storage/${assetId}`,
        uploadHeaders: { 'Content-Type': body.mimeType },
        expiresAt: nowIso(),
      },
      { status: 201 },
    );
  }),
  mswHttp.put(`${BASE}/mock-storage/:assetId`, () => new HttpResponse(null, { status: 200 })),
  mswHttp.post(`${BASE}/assets/:assetId/complete`, ({ params }) =>
    HttpResponse.json({ assetId: params.assetId, imageUrl: 'https://placehold.co/80' }),
  ),
];
