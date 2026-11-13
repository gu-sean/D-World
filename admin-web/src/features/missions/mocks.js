import { delay, http as mswHttp, HttpResponse } from 'msw';

// MSW handlers for the mission screens (M40~M50, M74~M75). Used with VITE_USE_MSW=true, no backend needed. State lives in memory.
const BASE = import.meta.env.VITE_ADMIN_API_BASE_URL ?? '/admin/v1';

const id = (n) => `04${String(n).padStart(6, '0')}`;
const NOW = '2026-11-04T01:00:00.000Z';

const categories = [{ id: id(1), code: 'exercise', name: '운동', displayOrder: 1, isActive: true }];
const difficulties = [
  { id: id(11), code: 'easy', name: '쉬움', displayOrder: 1, isActive: true },
  { id: id(12), code: 'hard', name: '어려움', displayOrder: 2, isActive: true },
];
const rewardRates = [
  {
    id: id(21),
    categoryId: id(1),
    difficultyId: id(11),
    versionNo: 1,
    points: 10,
    userXp: 5,
    petXp: 5,
    effectiveAt: NOW,
  },
];
const makeDefinition = (n, fields) => ({
  id: id(100 + n),
  origin: 'admin',
  description: null,
  categoryId: id(1),
  difficultyId: id(11),
  exerciseCode: 'push_up',
  estimatedDurationSeconds: 300,
  targetValue: 20,
  targetUnit: '회',
  verificationMethod: 'camera',
  publicationStatus: 'public',
  authorId: null,
  authorNickname: null,
  submittedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...fields,
});
const definitions = [
  makeDefinition(1, { title: '푸시업 20회' }),
  makeDefinition(2, { title: '스쿼트 30회', exerciseCode: 'squat' }),
  makeDefinition(3, {
    title: '사용자 달리기',
    origin: 'user',
    exerciseCode: 'running',
    verificationMethod: 'sensor',
    publicationStatus: 'review_pending',
    authorId: id(900),
    authorNickname: '러너',
    submittedAt: NOW,
  }),
];

const errorResponse = (status, code, message) =>
  HttpResponse.json({ error: { code, message, details: null } }, { status });
const needReason = (body) =>
  typeof body.reason !== 'string' || !body.reason.trim()
    ? errorResponse(400, 'COMMON_VALIDATION', 'reason: 필수 입력이에요.')
    : null;

// A category or difficulty linked to a public definition cannot be turned off (docs/09 M47).
const catalogHandlers = (path, list, isInUse) => [
  mswHttp.get(`${BASE}${path}`, () => HttpResponse.json(list)),
  mswHttp.post(`${BASE}${path}`, async ({ request }) => {
    await delay(100);
    const { reason, ...body } = await request.json();
    const invalid = needReason({ reason });
    if (invalid) return invalid;
    const item = { id: id(500 + list.length), isActive: true, ...body };
    list.push(item);
    return HttpResponse.json(item, { status: 201 });
  }),
  mswHttp.patch(`${BASE}${path}/:itemId`, async ({ request, params }) => {
    const { reason, ...patch } = await request.json();
    const invalid = needReason({ reason });
    if (invalid) return invalid;
    const item = list.find((entry) => entry.id === params.itemId);
    if (!item) return errorResponse(404, 'COMMON_NOT_FOUND', '찾을 수 없어요.');
    if (patch.isActive === false && isInUse(item)) {
      return errorResponse(409, 'CATALOG_IN_USE', '사용 중이라 끌 수 없어요.');
    }
    Object.assign(item, patch);
    return HttpResponse.json(item);
  }),
];

export const handlers = [
  mswHttp.get(`${BASE}/mission-definitions`, ({ request }) => {
    const url = new URL(request.url);
    const origin = url.searchParams.get('origin');
    const status = url.searchParams.get('publicationStatus');
    const categoryId = url.searchParams.get('categoryId');
    const query = url.searchParams.get('query');
    const page = Number(url.searchParams.get('page') ?? 1);
    const size = Number(url.searchParams.get('size') ?? 20);
    const rows = definitions.filter(
      (row) =>
        (!origin || row.origin === origin) &&
        (!status || row.publicationStatus === status) &&
        (!categoryId || row.categoryId === categoryId) &&
        (!query || row.title.includes(query)),
    );
    return HttpResponse.json({
      items: rows.slice((page - 1) * size, page * size),
      page,
      size,
      totalCount: rows.length,
    });
  }),
  mswHttp.get(`${BASE}/mission-definitions/:definitionId`, ({ params }) => {
    const row = definitions.find((entry) => entry.id === params.definitionId);
    return row
      ? HttpResponse.json(row)
      : errorResponse(404, 'definition_not_found', '미션 틀을 찾을 수 없어요.');
  }),
  mswHttp.post(`${BASE}/mission-definitions`, async ({ request }) => {
    await delay(100);
    const { reason, ...body } = await request.json();
    const invalid = needReason({ reason });
    if (invalid) return invalid;
    const row = makeDefinition(definitions.length + 1, { publicationStatus: 'public', ...body });
    definitions.push(row);
    return HttpResponse.json(row, { status: 201 });
  }),
  mswHttp.patch(`${BASE}/mission-definitions/:definitionId`, async ({ request, params }) => {
    const { reason, ...patch } = await request.json();
    const invalid = needReason({ reason });
    if (invalid) return invalid;
    if (Object.keys(patch).length === 0) {
      return errorResponse(400, 'COMMON_VALIDATION', '바꿀 항목이 없음');
    }
    const row = definitions.find((entry) => entry.id === params.definitionId);
    if (!row) return errorResponse(404, 'definition_not_found', '미션 틀을 찾을 수 없어요.');
    Object.assign(row, patch);
    return HttpResponse.json(row);
  }),
  mswHttp.post(`${BASE}/mission-definitions/:definitionId/reviews`, async ({ request, params }) => {
    const body = await request.json();
    const invalid = needReason(body);
    if (invalid) return invalid;
    const row = definitions.find((entry) => entry.id === params.definitionId);
    if (!row) return errorResponse(404, 'definition_not_found', '미션 틀을 찾을 수 없어요.');
    row.publicationStatus = { approved: 'public', rejected: 'rejected', hidden: 'hidden' }[
      body.decision
    ];
    return HttpResponse.json({
      id: row.id,
      publicationStatus: row.publicationStatus,
      decidedAt: NOW,
    });
  }),

  ...catalogHandlers('/goal-categories', categories, (item) =>
    definitions.some((row) => row.categoryId === item.id && row.publicationStatus === 'public'),
  ),
  ...catalogHandlers('/difficulty-levels', difficulties, (item) =>
    definitions.some((row) => row.difficultyId === item.id && row.publicationStatus === 'public'),
  ),

  mswHttp.get(`${BASE}/mission-reward-rates`, () => HttpResponse.json(rewardRates)),
  mswHttp.post(`${BASE}/mission-reward-rates`, async ({ request }) => {
    const { reason, ...body } = await request.json();
    const invalid = needReason({ reason });
    if (invalid) return invalid;
    const row = {
      id: id(600 + rewardRates.length),
      versionNo: rewardRates.length + 1,
      effectiveAt: NOW,
      ...body,
    };
    rewardRates.push(row);
    return HttpResponse.json(row, { status: 201 });
  }),
];
