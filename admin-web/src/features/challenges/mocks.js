import { delay, http as mswHttp, HttpResponse } from 'msw';

// MSW handlers for the admin challenge API M51~M61 plus the catalogs the form needs.
const BASE = import.meta.env.VITE_ADMIN_API_BASE_URL ?? '/admin/v1';

const CATEGORY_ID = '11111111-0000-4000-8000-000000000001';
const DIFFICULTY_ID = '22222222-0000-4000-8000-000000000001';

const makeChallenge = (id, fields) => ({
  id,
  origin: 'admin',
  title: '',
  description: '모의 데이터입니다.',
  categoryId: CATEGORY_ID,
  difficultyId: DIFFICULTY_ID,
  verificationMethod: 'camera',
  exerciseCode: 'push_up',
  targetValue: 20,
  targetUnit: '회',
  estimatedDurationSeconds: 300,
  startDate: '2026-10-01',
  endDate: '2026-10-14',
  requiredSuccessDays: 10,
  maxParticipants: 100,
  publicationStatus: 'public',
  settlementStatus: 'not_started',
  phase: 'ended',
  publishedAt: '2026-09-25T00:00:00Z',
  cancelledAt: null,
  creatorNickname: null,
  participantCount: 3,
  reward: { points: 500, userXp: 50, petXp: 30, badgeAchievementVersionId: null },
  ...fields,
});

let challenges;
let runs;
let counter;

const nowIso = () => new Date().toISOString();
const errorResponse = (status, code, message) =>
  HttpResponse.json({ error: { code, message, details: null } }, { status });

function reset() {
  counter = 100;
  challenges = [
    makeChallenge('c0000000-0000-4000-8000-000000000001', { title: '14일 푸시업 챌린지' }),
    makeChallenge('c0000000-0000-4000-8000-000000000002', {
      title: '주말 러닝 챌린지',
      origin: 'user',
      creatorNickname: '러너',
      publicationStatus: 'review_pending',
      phase: 'recruiting',
      startDate: '2026-12-01',
      endDate: '2026-12-07',
      verificationMethod: 'sensor',
      exerciseCode: 'running',
      requiredSuccessDays: 5,
    }),
    makeChallenge('c0000000-0000-4000-8000-000000000003', {
      title: '새 공식 챌린지',
      publicationStatus: 'draft',
      phase: 'recruiting',
      startDate: '2026-12-01',
      endDate: '2026-12-14',
      participantCount: 0,
    }),
  ];
  runs = new Map();
}
reset();

const find = (id) => challenges.find((c) => c.id === id);
const entries = [
  ['p1', 'u1', '민수', 130, 13],
  ['p2', 'u2', '지은', 120, 12],
  ['p3', 'u3', '하늘', 90, 9],
];

const settlementEntries = () =>
  entries.map(([participationId, , , score, successfulDays], index) => ({
    participationId,
    rank: index + 1,
    outcome: successfulDays >= 10 ? 'completed' : 'failed',
    successfulDays,
    score,
    lastQualifyingSubmittedAt: nowIso(),
    promisedPoints: successfulDays >= 10 ? 500 : 0,
    paidPoints: 0,
    userXp: successfulDays >= 10 ? 50 : 0,
    petXp: successfulDays >= 10 ? 30 : 0,
    paymentStatus: successfulDays >= 10 ? 'pending' : 'none',
    exclusionReason: null,
  }));

export const handlers = [
  mswHttp.get(`${BASE}/goal-categories`, () =>
    HttpResponse.json([
      { id: CATEGORY_ID, code: 'fitness', name: '운동', displayOrder: 1, isActive: true },
    ]),
  ),
  mswHttp.get(`${BASE}/difficulty-levels`, () =>
    HttpResponse.json([
      { id: DIFFICULTY_ID, code: 'normal', name: '보통', displayOrder: 1, isActive: true },
    ]),
  ),

  mswHttp.get(`${BASE}/challenges`, async ({ request }) => {
    await delay(150);
    const url = new URL(request.url);
    const pick = (name) => url.searchParams.get(name);
    const page = Number(pick('page') ?? 1);
    const size = Number(pick('size') ?? 20);
    const rows = challenges.filter(
      (c) =>
        (!pick('publicationStatus') || c.publicationStatus === pick('publicationStatus')) &&
        (!pick('settlementStatus') || c.settlementStatus === pick('settlementStatus')) &&
        (!pick('phase') || c.phase === pick('phase')) &&
        (!pick('origin') || c.origin === pick('origin')),
    );
    return HttpResponse.json({
      items: rows.slice((page - 1) * size, page * size),
      page,
      size,
      totalCount: rows.length,
    });
  }),

  mswHttp.get(`${BASE}/challenges/:id`, ({ params }) => {
    const challenge = find(params.id);
    return challenge
      ? HttpResponse.json(challenge)
      : errorResponse(404, 'COMMON_NOT_FOUND', '찾을 수 없어요.');
  }),

  mswHttp.post(`${BASE}/challenges`, async ({ request }) => {
    const { reason, ...body } = await request.json();
    if (!reason) return errorResponse(400, 'COMMON_VALIDATION', '사유를 입력해 주세요.');
    counter += 1;
    const created = makeChallenge(`c0000000-0000-4000-8000-${String(counter).padStart(12, '0')}`, {
      ...body,
      publicationStatus: 'draft',
      phase: 'recruiting',
      participantCount: 0,
    });
    challenges.unshift(created);
    return HttpResponse.json(created, { status: 201 });
  }),

  mswHttp.patch(`${BASE}/challenges/:id`, async ({ params, request }) => {
    const challenge = find(params.id);
    if (!challenge) return errorResponse(404, 'COMMON_NOT_FOUND', '찾을 수 없어요.');
    const { action, reason, ...patch } = await request.json();
    if (!reason) return errorResponse(400, 'COMMON_VALIDATION', '사유를 입력해 주세요.');
    if (action === 'publish') challenge.publicationStatus = 'public';
    else if (action === 'hide') challenge.publicationStatus = 'hidden';
    else if (action === 'cancel') challenge.publicationStatus = 'cancelled';
    else Object.assign(challenge, patch);
    return HttpResponse.json(challenge);
  }),

  mswHttp.post(`${BASE}/challenges/:id/reviews`, async ({ params, request }) => {
    const challenge = find(params.id);
    if (!challenge) return errorResponse(404, 'COMMON_NOT_FOUND', '찾을 수 없어요.');
    const { decision } = await request.json();
    challenge.publicationStatus =
      decision === 'approved' ? 'public' : decision === 'rejected' ? 'rejected' : 'hidden';
    return HttpResponse.json(challenge);
  }),

  mswHttp.get(`${BASE}/challenges/:id/rankings`, () =>
    HttpResponse.json({
      ranking: { challengeId: 'mock', calculatedAt: nowIso() },
      entries: entries.map(([participationId, userId, nickname, score, successfulDays], i) => ({
        participationId,
        userId,
        nickname,
        rankNo: i + 1,
        score,
        successfulDays,
        flags: [],
      })),
    }),
  ),

  mswHttp.get(`${BASE}/challenges/:id/participants/:participationId/days`, () =>
    HttpResponse.json({
      items: [
        {
          id: 'd1',
          date: '2026-10-01',
          status: 'success',
          missionId: 'm1',
          qualifyingRecordId: 'r1',
          qualifyingResultId: 'v1',
        },
        {
          id: 'd2',
          date: '2026-10-02',
          status: 'failed',
          missionId: 'm2',
          qualifyingRecordId: null,
          qualifyingResultId: null,
        },
        {
          id: 'd3',
          date: '2026-10-03',
          status: 'excluded',
          missionId: 'm3',
          qualifyingRecordId: null,
          qualifyingResultId: null,
        },
      ],
    }),
  ),

  mswHttp.post(`${BASE}/challenges/:id/moderation-actions`, async ({ params, request }) => {
    const body = await request.json();
    if (!body.reason) return errorResponse(400, 'COMMON_VALIDATION', '사유를 입력해 주세요.');
    if (body.action !== 'disqualify' && !body.dailyMissionId) {
      return errorResponse(400, 'COMMON_VALIDATION', 'dailyMissionId가 필요해요.');
    }
    return HttpResponse.json({ ranking: { challengeId: params.id, calculatedAt: nowIso() } });
  }),

  mswHttp.post(`${BASE}/challenges/:id/settlement-runs`, async ({ params }) => {
    const challenge = find(params.id);
    if (!challenge) return errorResponse(404, 'COMMON_NOT_FOUND', '찾을 수 없어요.');
    counter += 1;
    const run = {
      id: `a0000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
      challengeId: params.id,
      runNo: runs.size + 1,
      status: 'draft',
      basedOnAt: nowIso(),
      confirmedAt: null,
      reason: null,
      entries: settlementEntries(),
      blockers: {
        notEnded: false,
        pendingDays: 0,
        waitingSubmissions: 0,
        incompleteParticipants: 0,
        ready: true,
      },
    };
    runs.set(run.id, run);
    challenge.settlementStatus = 'draft';
    return HttpResponse.json(run, { status: 201 });
  }),

  mswHttp.get(`${BASE}/settlement-runs/:runId`, ({ params }) => {
    const run = runs.get(params.runId);
    return run
      ? HttpResponse.json(run)
      : errorResponse(404, 'settlement_not_found', '정산을 찾을 수 없어요.');
  }),

  mswHttp.post(`${BASE}/settlement-runs/:runId/confirm`, async ({ params }) => {
    const run = runs.get(params.runId);
    if (!run) return errorResponse(404, 'settlement_not_found', '정산을 찾을 수 없어요.');
    run.status = 'confirmed';
    run.confirmedAt = nowIso();
    delete run.blockers;
    run.entries = run.entries.map((e) => ({
      ...e,
      paidPoints: e.promisedPoints,
      paymentStatus: e.promisedPoints > 0 ? 'paid' : 'none',
    }));
    const challenge = find(run.challengeId);
    if (challenge) challenge.settlementStatus = 'confirmed';
    return HttpResponse.json(run);
  }),

  mswHttp.post(`${BASE}/settlement-runs/:runId/payments/retry`, () =>
    HttpResponse.json({ retriedCount: 0 }, { status: 202 }),
  ),
];

/** test helper: restores the in-memory data */
export const resetMockData = reset;
