import { delay, http as mswHttp, HttpResponse } from 'msw';

// MSW handlers for M30~M37 (verification review, appeals, criteria). Used with VITE_USE_MSW=true.
const BASE = import.meta.env.VITE_ADMIN_API_BASE_URL ?? '/admin/v1';

const CATEGORY_ID = 'srCAfcNs';
const now = Date.now();
const hoursAgo = (h) => new Date(now - h * 3600 * 1000).toISOString();

const records = [1, 2, 3].map((n) => ({
  recordId: `a400000${n}`,
  missionId: `b400000${n}`,
  userId: `c400000${n}`,
  userNickname: `사용자${n}`,
  status: 'review_required',
  attemptNo: 1,
  submissionNo: 1,
  evidenceKind: 'camera_media',
  startedAt: hoursAgo(n + 2),
  submittedAt: hoursAgo(n),
  completedAt: null,
  metrics: { steps: 4200 * n },
  mission: {
    title: `가상 미션 ${n}`,
    description: '가상 데이터입니다.',
    status: 'active',
    verificationMethod: n === 2 ? 'sensor' : 'camera',
    targetValue: 5000,
    targetUnit: '걸음',
    categoryId: CATEGORY_ID,
    scheduledDate: '2026-11-04',
  },
  results: [
    {
      id: `d400000${n}`,
      resultNo: 1,
      source: 'ai',
      decision: 'review_required',
      engineVersion: 'vision-1.2',
      confidence: 0.55 + n / 10,
      metrics: {
        exerciseCode: 'push_up',
        repCount: 18,
        validRepCount: 16,
        invalidRepCount: 2,
        accuracy: 0.89,
        durationSeconds: 42,
        personDetected: true,
        mediaSha256: 'ab12cd34ef56',
        flags: ['low_confidence'],
        issues: [],
      },
      reason: '증거가 불명확해요.',
      reviewedByAdminId: null,
      isCurrent: true,
      decidedAt: hoursAgo(n),
      notifiedAt: null,
    },
  ],
  appeals: [],
  files: [],
}));

const appeals = [
  {
    id: 'e4000001',
    recordId: records[0].recordId,
    status: 'open',
    reason: '운동 중인 사진이 맞아요. 다시 확인해 주세요.',
    filedAt: hoursAgo(1),
    resolvedAt: null,
    resolution: null,
  },
];

const summary = (record) => ({
  recordId: record.recordId,
  missionId: record.missionId,
  userId: record.userId,
  status: record.status,
  attemptNo: record.attemptNo,
  submissionNo: record.submissionNo,
  evidenceKind: record.evidenceKind,
  submittedAt: record.submittedAt,
  recordMetrics: record.metrics,
  mission: record.mission,
  ai: {
    engineVersion: record.results[0].engineVersion,
    confidence: record.results[0].confidence,
    reason: record.results[0].reason,
    metrics: null,
    decidedAt: record.results[0].decidedAt,
  },
});

let criteria = [
  {
    id: 'f4000001',
    categoryId: CATEGORY_ID,
    verificationMethod: 'camera',
    versionNo: 1,
    rules: { minConfidence: 0.8 },
    effectiveAt: hoursAgo(100),
  },
];

const errorResponse = (status, code, message) =>
  HttpResponse.json({ error: { code, message, details: null } }, { status });

const page = (items, url) => {
  const params = new URL(url).searchParams;
  const pageNo = Number(params.get('page') ?? 1);
  const size = Number(params.get('size') ?? 20);
  return {
    items: items.slice((pageNo - 1) * size, pageNo * size),
    page: pageNo,
    size,
    totalCount: items.length,
  };
};

export const handlers = [
  mswHttp.get(`${BASE}/verifications`, async ({ request }) => {
    await delay(200);
    const params = new URL(request.url).searchParams;
    const status = params.get('status') ?? 'review_required';
    const method = params.get('method');
    const rows = records
      .filter((r) => r.status === status)
      .filter((r) => !method || r.mission.verificationMethod === method)
      .map(summary);
    return HttpResponse.json(page(rows, request.url), {
      headers: {
        'X-Completed-Today': String(records.filter((r) => r.status !== 'review_required').length),
      },
    });
  }),

  mswHttp.get(`${BASE}/verifications/:id`, ({ params }) => {
    const record = records.find((r) => r.recordId === params.id);
    return record
      ? HttpResponse.json(record)
      : errorResponse(404, 'COMMON_NOT_FOUND', '찾을 수 없어요.');
  }),

  mswHttp.post(`${BASE}/verifications/:id/decisions`, async ({ params, request }) => {
    await delay(200);
    const record = records.find((r) => r.recordId === params.id);
    if (!record) return errorResponse(404, 'COMMON_NOT_FOUND', '찾을 수 없어요.');
    if (record.status !== 'review_required') {
      return errorResponse(409, 'VERIFICATION_NOT_REVIEWABLE', '이미 처리된 인증이에요.');
    }
    const { decision } = await request.json();
    record.status = decision;
    return HttpResponse.json({ recordId: record.recordId, status: decision });
  }),

  mswHttp.get(`${BASE}/appeals`, ({ request }) => {
    const status = new URL(request.url).searchParams.get('status') ?? 'open';
    const rows = appeals
      .filter((a) => a.status === status)
      .map((a) => {
        const record = records.find((r) => r.recordId === a.recordId);
        return {
          id: a.id,
          recordId: a.recordId,
          missionId: record.missionId,
          userId: record.userId,
          nickname: record.userNickname,
          missionTitle: record.mission.title,
          originalDecision: 'rejected',
          status: a.status,
          reason: a.reason,
          filedAt: a.filedAt,
          resolvedAt: a.resolvedAt,
        };
      });
    return HttpResponse.json(page(rows, request.url));
  }),

  mswHttp.get(`${BASE}/appeals/:id`, ({ params }) => {
    const appeal = appeals.find((a) => a.id === params.id);
    if (!appeal) return errorResponse(404, 'COMMON_NOT_FOUND', '찾을 수 없어요.');
    const verification = records.find((r) => r.recordId === appeal.recordId);
    return HttpResponse.json({ appeal, verification });
  }),

  mswHttp.post(`${BASE}/appeals/:id/resolution`, async ({ params, request }) => {
    await delay(200);
    const appeal = appeals.find((a) => a.id === params.id);
    if (!appeal) return errorResponse(404, 'COMMON_NOT_FOUND', '찾을 수 없어요.');
    if (appeal.status !== 'open') {
      return errorResponse(409, 'APPEAL_ALREADY_RESOLVED', '이미 처리된 이의 신청이에요.');
    }
    const { decision, reason } = await request.json();
    appeal.status = decision === 'approved' ? 'accepted' : 'rejected';
    appeal.resolvedAt = new Date().toISOString();
    appeal.resolution = { decision, reason };
    return HttpResponse.json({ appealId: appeal.id, status: appeal.status });
  }),

  mswHttp.get(`${BASE}/goal-categories`, () =>
    HttpResponse.json([
      { id: CATEGORY_ID, code: 'exercise', name: '운동', displayOrder: 1, isActive: true },
    ]),
  ),

  mswHttp.get(`${BASE}/verification-criteria`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    const rows = criteria
      .filter((c) => !params.get('categoryId') || c.categoryId === params.get('categoryId'))
      .filter((c) => !params.get('method') || c.verificationMethod === params.get('method'));
    return HttpResponse.json(rows);
  }),

  mswHttp.post(`${BASE}/verification-criteria`, async ({ request }) => {
    await delay(200);
    const body = await request.json();
    if (!body.rules || typeof body.rules !== 'object' || Array.isArray(body.rules)) {
      return errorResponse(400, 'CRITERIA_RULES_INVALID', '판정 기준 형식이 맞지 않아요.');
    }
    const created = {
      id: crypto.randomUUID(),
      categoryId: body.categoryId,
      verificationMethod: body.verificationMethod,
      versionNo: criteria.filter((c) => c.categoryId === body.categoryId).length + 1,
      rules: body.rules,
      effectiveAt: body.effectiveAt ?? new Date().toISOString(),
    };
    criteria = [created, ...criteria];
    return HttpResponse.json(created, { status: 201 });
  }),
];
