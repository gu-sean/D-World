/**
 * 가짜 서버 (`USE_MOCK_API=true`) — parts/mobile-client §3.1 6번, tasks MC-05.
 *
 * 백엔드 없이 화면을 만들 수 있게 08의 **모든 GET**과 주요 POST에 07 모양 그대로 응답한다.
 * 상태는 모듈 안 메모리에만 있고, 앱을 다시 켜면 처음으로 돌아간다.
 *
 * 판정은 제출 6초 뒤에 붙고, 결과는 개발용 AI 드라이버(12 §9)와 같게 목표값 끝자리로 정한다.
 */
import { todayKst } from '../format/format.js';
import * as catalog from './fixtures/catalog.js';
import * as account from './fixtures/account.js';
import * as goalsFx from './fixtures/goals.js';
import * as missionsFx from './fixtures/missions.js';
import * as recordsFx from './fixtures/records.js';
import * as rewardsFx from './fixtures/rewards.js';
import * as socialFx from './fixtures/social.js';
import * as supportFx from './fixtures/support.js';

/** 05 §2.2 오류 본문. */
function error(status, code, message, details = null) {
  return { status, body: { error: { code, message: message ?? null, details } } };
}

function ok(body, headers) {
  return { status: 200, body, headers };
}

function created(body) {
  return { status: 201, body };
}

const noContent = { status: 204, body: undefined };

/**
 * 05 §6 커서 목록. 커서는 앱이 해석하지 않으므로 여기서는 그냥 자리 번호를 쓴다.
 */
function page(items, query = {}) {
  const limit = Math.min(Number(query.limit) || 20, 50);
  const offset = Number(query.cursor) || 0;
  const slice = items.slice(offset, offset + limit);
  const next = offset + limit;
  return { items: slice, nextCursor: next < items.length ? String(next) : null };
}

/** `?status=a,b` 를 배열로. */
function multi(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value).split(',').filter(Boolean);
}

let store = null;
let sequence = 0;
/**
 * 새로 만든 것의 ID. `new`를 끼워 넣어 **씨앗 데이터의 ID와 절대 겹치지 않게** 한다
 * (`mission-0001`이 둘이 되면 조회가 엉뚱한 것을 집는다).
 */
const nextId = (prefix) => {
  sequence += 1;
  return `${prefix}-new-${String(sequence).padStart(4, '0')}`;
};

function createStore(nowMs) {
  return {
    missions: missionsFx.seedMissions(nowMs),
    goals: [goalsFx.goal({}, nowMs)],
    challenges: socialFx.seedChallenges(nowMs),
    recommendations: [socialFx.recommendation({}, nowMs)],
    notifications: supportFx.notifications(nowMs),
    tickets: supportFx.supportTickets(nowMs),
    /** @type {Array<object>} 회차 (메모리에만) */
    records: [],
    /** @type {Array<object>} 올린 파일 */
    media: [],
  };
}

function db(nowMs) {
  if (!store) store = createStore(nowMs);
  return store;
}

const findMission = (data, id) => data.missions.find((m) => m.id === id) ?? null;
const findRecord = (data, id) => data.records.find((r) => r.id === id) ?? null;

/** 제출하고 6초가 지났으면 판정을 붙인다. */
function settle(record, mission, nowMs) {
  if (record.decision) return;
  if (record.status !== 'submitted') return;
  if (nowMs - record.submittedAtMs < recordsFx.DECISION_DELAY_MS) return;

  const decision = recordsFx.decisionFor(mission?.targetValue);
  record.decision = decision;
  record.status = decision;
  if (mission) {
    mission.status = decision === 'approved'
      ? 'completed'
      : (decision === 'rejected' ? 'failed' : 'submitted');
  }
}

/**
 * 경로 표. 위에서부터 처음 맞는 줄이 응답한다.
 * `:이름` 자리는 `params`로 들어온다.
 */
const routes = [
  // ── 08 §1 계정 ─────────────────────────────────────────────────────
  ['POST', '/auth/phone-verifications', ({ now }) => created(account.phoneVerificationStarted(now))],
  ['POST', '/auth/phone-verifications/:verificationId/confirm', ({ body, now }) => (
    body?.code === account.DEV_OTP
      ? ok(account.phoneVerificationConfirmed('new', now))
      : error(400, 'AUTH_OTP_INVALID', '인증번호가 맞지 않아요.', { attemptsLeft: 4 })
  )],
  ['GET', '/auth/nickname-availability', ({ query }) => ok({ available: query.nickname !== '개발유저' })],
  ['GET', '/policy-documents/current', () => ok(account.policyDocuments)],
  ['POST', '/auth/signup', ({ now }) => created(account.session(now))],
  ['POST', '/auth/login', ({ body, now }) => (
    body?.phoneNumber === account.DEV_PHONE && body?.password === account.DEV_PASSWORD
      ? ok(account.session(now))
      : error(401, 'AUTH_INVALID_CREDENTIALS', '휴대폰 번호 또는 비밀번호가 맞지 않아요.')
  )],
  ['POST', '/auth/social/:provider/login', ({ now }) => ok(account.session(now))],
  ['POST', '/auth/password-reset', () => noContent],
  ['POST', '/auth/token/refresh', ({ now }) => ok(account.session(now))],
  ['POST', '/auth/logout', () => noContent],
  ['GET', '/me', () => ok(account.me())],
  ['PATCH', '/me/profile', ({ body }) => ok(account.me({ ...body }))],
  ['POST', '/me/consents', () => noContent],
  ['POST', '/me/withdrawal-requests', () => ({ status: 202, body: { requestId: nextId('withdrawal'), status: 'requested' } })],
  ['PUT', '/me/push-devices', () => noContent],
  ['POST', '/me/push-devices/unregister', () => noContent],

  // ── 08 §2 기준 데이터 ──────────────────────────────────────────────
  ['GET', '/goal-categories', () => ok(catalog.goalCategories)],
  ['GET', '/difficulty-levels', () => ok(catalog.difficultyLevels)],
  ['GET', '/exercise-types', () => ok(catalog.exerciseTypes)],

  // ── 08 §3 목표·계획 ────────────────────────────────────────────────
  ['POST', '/goals', ({ body, now, data }) => {
    const created_ = goalsFx.goal({ ...body, id: nextId('goal'), hasAcceptedPlan: false, progressRate: 0 }, now);
    data.goals.unshift(created_);
    return created(created_);
  }],
  ['GET', '/goals', ({ query, data }) => {
    const wanted = multi(query.status);
    const items = data.goals.filter((g) => (!wanted || wanted.includes(g.status))
      && (!query.categoryCode || g.categoryCode === query.categoryCode));
    return ok(page(items, query));
  }],
  ['PATCH', '/goals/:goalId', ({ params, body, now, data }) => {
    const found = data.goals.find((g) => g.id === params.goalId);
    if (!found) return error(404, 'COMMON_NOT_FOUND');
    Object.assign(found, body);
    return ok(goalsFx.goalDetail(found, now));
  }],
  ['GET', '/goals/:goalId', ({ params, now, data }) => {
    const found = data.goals.find((g) => g.id === params.goalId);
    if (!found) return error(404, 'COMMON_NOT_FOUND');
    return ok(goalsFx.goalDetail(found, now));
  }],
  ['DELETE', '/goals/:goalId', ({ params, data }) => {
    data.goals = data.goals.filter((g) => g.id !== params.goalId);
    return noContent;
  }],
  ['POST', '/goals/:goalId/plan-proposals', ({ params, now }) => created(goalsFx.planProposal(params.goalId, now))],
  ['GET', '/goals/:goalId/plan-proposals/latest', ({ params, now }) => ok(goalsFx.planProposal(params.goalId, now))],
  ['POST', '/plan-proposals/:proposalId/accept', ({ now, data }) => {
    const todayMissions = data.missions.filter((m) => m.scheduledDate === todayKst(now));
    return created({
      goal: goalsFx.goalDetail({ hasAcceptedPlan: true }, now),
      createdMissionCount: 4,
      todayMissions,
    });
  }],
  ['POST', '/plan-proposals/:proposalId/reject', () => noContent],

  // ── 08 §4 홈 ───────────────────────────────────────────────────────
  ['GET', '/home', ({ query, now, data }) => ok(missionsFx.homeSummary(query.date ?? todayKst(now), data.missions, now))],

  // ── 08 §5 미션 ─────────────────────────────────────────────────────
  ['GET', '/missions', ({ query, data }) => {
    const wanted = multi(query.status);
    const items = data.missions.filter((m) => {
      if (m.status === 'cancelled') return false;
      if (query.date && m.scheduledDate !== query.date) return false;
      if (query.from && m.scheduledDate < query.from) return false;
      if (query.to && m.scheduledDate > query.to) return false;
      if (query.goalId && m.goalId !== query.goalId) return false;
      if (query.categoryCode && m.categoryCode !== query.categoryCode) return false;
      if (wanted && !wanted.includes(m.status)) return false;
      return true;
    });
    return ok(page(items, query));
  }],
  ['POST', '/missions', ({ body, now, data }) => {
    const base = body.definitionId
      ? missionsFx.missionDefinitions.find((d) => d.id === body.definitionId) ?? {}
      : body;
    const made = missionsFx.mission({
      ...base,
      id: nextId('mission'),
      sourceType: body.definitionId ? 'template' : 'user',
      goalId: body.goalId ?? null,
      scheduledDate: body.scheduledDate ?? todayKst(now),
      status: 'scheduled',
    }, now);
    data.missions.push(made);
    return created(made);
  }],
  ['GET', '/missions/:missionId', ({ params, now, data }) => {
    const found = findMission(data, params.missionId);
    if (!found) return error(404, 'COMMON_NOT_FOUND');
    const records = data.records.filter((r) => r.missionId === found.id);
    const latest = records.at(-1);
    const detail = missionsFx.missionDetail(found, now);
    if (latest) {
      detail.latestRecord = {
        id: latest.id,
        attemptNo: latest.attemptNo,
        status: latest.status,
        decision: latest.decision ?? null,
        startedAt: new Date(latest.startedAtMs).toISOString(),
      };
      detail.submissionCount = records.filter((r) => r.submissionNo).length;
      detail.remainingSubmissions = Math.max(0, 4 - detail.submissionCount);
    }
    return ok(detail);
  }],
  ['PATCH', '/missions/:missionId', ({ params, body, now, data }) => {
    const found = findMission(data, params.missionId);
    if (!found) return error(404, 'COMMON_NOT_FOUND');
    if (found.status !== 'scheduled') return error(409, 'MISSION_LOCKED_AFTER_START', '시작한 미션은 고칠 수 없어요.');
    Object.assign(found, body);
    return ok(missionsFx.missionDetail(found, now));
  }],
  ['POST', '/missions/:missionId/cancel', ({ params, data }) => {
    const found = findMission(data, params.missionId);
    if (!found) return error(404, 'COMMON_NOT_FOUND');
    if (found.status !== 'scheduled') return error(409, 'MISSION_LOCKED_AFTER_START', '시작한 미션은 고칠 수 없어요.');
    found.status = 'cancelled';
    return ok(found);
  }],
  ['GET', '/mission-definitions', ({ query }) => {
    const items = missionsFx.missionDefinitions.filter((d) => (
      (!query.categoryCode || d.categoryCode === query.categoryCode)
      && (!query.difficultyCode || d.difficultyCode === query.difficultyCode)
      && (!query.exerciseCode || d.exerciseCode === query.exerciseCode)
    ));
    return ok(page(items, query));
  }],
  ['GET', '/recommendations/next-missions', () => ok(missionsFx.missionDefinitions.slice(0, 3))],

  // ── 08 §6 수행 인증 ────────────────────────────────────────────────
  ['POST', '/missions/:missionId/records', ({ params, now, data }) => {
    const mission = findMission(data, params.missionId);
    if (!mission) return error(404, 'COMMON_NOT_FOUND');
    if (mission.scheduledDate !== todayKst(now)) {
      return error(409, 'MISSION_NOT_STARTABLE', '지금은 시작할 수 없는 미션이에요.', { reason: 'not_today' });
    }
    const attempts = data.records.filter((r) => r.missionId === mission.id);
    const record = {
      id: nextId('record'),
      missionId: mission.id,
      attemptNo: attempts.length + 1,
      submissionNo: null,
      status: 'recording',
      evidenceKind: null,
      startedAtMs: now,
      submittedAtMs: null,
      decision: null,
      media: [],
    };
    data.records.push(record);
    mission.status = 'in_progress';
    return created(recordsFx.missionRecord(record, mission, now));
  }],
  ['GET', '/mission-records/:recordId', ({ params, now, data }) => {
    const record = findRecord(data, params.recordId);
    if (!record) return error(404, 'COMMON_NOT_FOUND');
    const mission = findMission(data, record.missionId);
    settle(record, mission, now);
    return ok(recordsFx.missionRecord(record, mission, now));
  }],
  ['POST', '/mission-records/:recordId/abort', ({ params, data }) => {
    const record = findRecord(data, params.recordId);
    if (!record) return error(404, 'COMMON_NOT_FOUND');
    if (record.status !== 'recording' && record.status !== 'uploading') {
      return error(409, 'VERIFY_RECORD_NOT_OPEN', '이미 제출했거나 끝난 기록이에요.');
    }
    record.status = 'aborted';
    const mission = findMission(data, record.missionId);
    if (mission) mission.status = 'scheduled';
    return noContent;
  }],
  ['POST', '/mission-records/:recordId/media', ({ params, body, now, data }) => {
    const record = findRecord(data, params.recordId);
    if (!record) return error(404, 'COMMON_NOT_FOUND');
    const mediaId = nextId('media');
    data.media.push({ mediaId, mediaKind: body.mediaKind, uploadStatus: 'pending' });
    record.status = 'uploading';
    return created({
      mediaId,
      uploadUrl: `https://mock-storage.local/upload/${mediaId}`,
      uploadMethod: 'PUT',
      uploadHeaders: { 'Content-Type': body.mimeType },
      expiresAt: new Date(now + 15 * 60 * 1000).toISOString(),
    });
  }],
  ['POST', '/media/:mediaId/complete', ({ params, data }) => {
    const file = data.media.find((m) => m.mediaId === params.mediaId);
    if (!file) return error(404, 'COMMON_NOT_FOUND');
    file.uploadStatus = 'uploaded';
    return ok({ ...file, sizeBytes: 1024 });
  }],
  ['POST', '/mission-records/:recordId/submit', ({ params, body, now, data }) => {
    const record = findRecord(data, params.recordId);
    if (!record) return error(404, 'COMMON_NOT_FOUND');
    const mission = findMission(data, record.missionId);
    const submissions = data.records.filter((r) => r.missionId === record.missionId && r.submissionNo);
    if (submissions.length >= 4) {
      return error(422, 'VERIFY_SUBMISSION_LIMIT', '이 미션은 4번까지 제출할 수 있어요.');
    }
    record.status = 'submitted';
    record.submissionNo = submissions.length + 1;
    record.submittedAtMs = now;
    record.evidenceKind = body.evidenceKind;
    record.media = data.media.map((m) => ({ ...m }));
    if (mission) mission.status = 'submitted';
    return { status: 202, body: recordsFx.missionRecord(record, mission, now) };
  }],
  ['POST', '/verification-results/:resultId/appeals', ({ now }) => created({
    id: nextId('appeal'),
    recordId: 'record-0001',
    originalResultId: 'result-0001',
    status: 'open',
    reason: '자세가 정확했다고 생각해요.',
    filedAt: new Date(now).toISOString(),
    resolvedAt: null,
  })],

  // ── 08 §7 계획 재조정 ──────────────────────────────────────────────
  ['GET', '/plan-adjustments', ({ query, now }) => ok(page([goalsFx.planAdjustment({}, now)], query))],
  ['GET', '/plan-adjustments/:adjustmentId', ({ params, now }) => ok(goalsFx.planAdjustment({ id: params.adjustmentId }, now))],
  ['POST', '/plan-adjustments/:adjustmentId/accept', ({ params, now, data }) => ok({
    adjustment: goalsFx.planAdjustment({ id: params.adjustmentId, status: 'accepted', decidedAt: new Date(now).toISOString() }, now),
    goal: goalsFx.goalDetail({}, now),
    todayMissions: data.missions.filter((m) => m.scheduledDate === todayKst(now)),
  })],
  ['POST', '/plan-adjustments/:adjustmentId/reject', () => noContent],

  // ── 08 §8 리포트 ───────────────────────────────────────────────────
  ['GET', '/reports/summary', ({ query, now }) => ok(supportFx.reportSummary(query, now))],
  ['GET', '/ai-reports', ({ query, now }) => ok(page([supportFx.aiReport('ai-report-0001', now)], query))],
  ['GET', '/ai-reports/:runId', ({ params, now }) => ok(supportFx.aiReport(params.runId, now))],
  ['POST', '/ai-reports/:runId/read', () => noContent],
  ['GET', '/calendar', ({ query, now }) => ok(supportFx.calendarDays(query.month ?? todayKst(now).slice(0, 7), now))],

  // ── 08 §9 포인트·상점·스트릭·업적 ──────────────────────────────────
  ['GET', '/shop/items', () => ok(rewardsFx.shopItems)],
  ['POST', '/shop/orders', ({ body, now }) => {
    const item = rewardsFx.shopItems.find((i) => i.id === body.itemId);
    if (!item) return error(409, 'SHOP_ITEM_UNAVAILABLE', '지금은 살 수 없는 상품이에요.');
    const total = item.pricePoints * (body.quantity ?? 1);
    if (total > rewardsFx.pointBalance.availablePoints) {
      return error(422, 'POINT_INSUFFICIENT', '포인트가 부족해요.');
    }
    return created({
      id: nextId('order'),
      itemId: item.id,
      quantity: body.quantity ?? 1,
      unitPoints: item.pricePoints,
      totalPoints: total,
      status: 'completed',
      balanceAfter: rewardsFx.pointBalance.availablePoints - total,
      createdAt: new Date(now).toISOString(),
    });
  }],
  ['GET', '/me/inventory', () => ok(rewardsFx.inventory)],
  ['GET', '/me/points', () => ok(rewardsFx.pointBalance)],
  ['GET', '/me/point-transactions', ({ query, now }) => {
    const all = rewardsFx.pointTransactions(now);
    const items = query.direction === 'earn'
      ? all.filter((t) => t.availableDelta > 0)
      : (query.direction === 'spend' ? all.filter((t) => t.availableDelta < 0) : all);
    return ok(page(items, query));
  }],
  ['GET', '/me/streak', ({ now }) => ok(rewardsFx.streakStatus(now))],
  ['GET', '/achievements', ({ query }) => ok(
    query.rarity ? rewardsFx.achievements.filter((a) => a.rarity === query.rarity) : rewardsFx.achievements,
  )],
  ['PUT', '/me/representative-badge', () => noContent],

  // ── 08 §10 펫 ──────────────────────────────────────────────────────
  ['GET', '/me/pets', () => ok(rewardsFx.myPets)],
  ['GET', '/pet-species', ({ query }) => ok(
    query.categoryCode ? rewardsFx.petSpecies.filter((s) => s.categoryCode === query.categoryCode) : rewardsFx.petSpecies,
  )],
  ['GET', '/pet-species/:speciesId', ({ params }) => {
    const found = rewardsFx.petSpecies.find((s) => s.id === params.speciesId);
    return found ? ok(found) : error(404, 'COMMON_NOT_FOUND');
  }],
  ['PUT', '/me/representative-pet', () => ok(rewardsFx.myPets[0])],
  ['POST', '/me/pets', ({ body }) => created({ ...rewardsFx.myPets[0], id: nextId('pet'), nickname: body.nickname })],
  ['GET', '/me/pets/:petId/evolution-events', () => ok(rewardsFx.petEvolutionEvents)],

  // ── 08 §11 상황 추천 ───────────────────────────────────────────────
  ['POST', '/recommendations/situational', ({ now, data }) => {
    data.recommendations = [socialFx.recommendation({ id: nextId('recommendation') }, now)];
    return created(data.recommendations);
  }],
  ['POST', '/recommendations/:recommendationId/accept', ({ now, data }) => {
    const made = missionsFx.mission({ id: nextId('mission'), sourceType: 'template', goalId: null, goalStepId: null, scheduledDate: todayKst(now) }, now);
    data.missions.push(made);
    data.recommendations = [];
    return created(made);
  }],
  ['POST', '/recommendations/:recommendationId/dismiss', ({ data }) => {
    data.recommendations = [];
    return noContent;
  }],
  ['GET', '/recommendations/active', ({ data }) => ok(data.recommendations)],

  // ── 08 §12 챌린지 ──────────────────────────────────────────────────
  ['GET', '/challenges', ({ query, data }) => {
    const items = data.challenges.filter((c) => (
      (!query.phase || c.phase === query.phase)
      && (!query.categoryCode || c.categoryCode === query.categoryCode)
    ));
    return ok(page(items, query));
  }],
  ['POST', '/challenges', ({ body, now, data }) => {
    const made = socialFx.challenge({
      ...body,
      id: nextId('challenge'),
      origin: 'user',
      publicationStatus: 'review_pending',
      phase: 'recruiting',
      participantCount: 0,
      joined: false,
    }, now);
    data.challenges.push(made);
    return created(made);
  }],
  ['GET', '/challenges/:challengeId/rankings', ({ now }) => ok(socialFx.challengeRanking(now))],
  ['GET', '/challenges/:challengeId', ({ params, data }) => {
    const found = data.challenges.find((c) => c.id === params.challengeId);
    return found ? ok(found) : error(404, 'COMMON_NOT_FOUND');
  }],
  ['POST', '/challenges/:challengeId/participations', ({ params, now, data }) => {
    const found = data.challenges.find((c) => c.id === params.challengeId);
    if (!found) return error(404, 'COMMON_NOT_FOUND');
    if (found.joined) return error(409, 'CHALLENGE_ALREADY_JOINED', '이미 참여한 챌린지예요.');
    found.joined = true;
    found.participantCount += 1;
    return created(socialFx.myChallenge(now));
  }],
  ['DELETE', '/challenges/:challengeId/participations/me', ({ params, data }) => {
    const found = data.challenges.find((c) => c.id === params.challengeId);
    if (!found || !found.joined) return error(409, 'CHALLENGE_NOT_JOINED', '참여 중인 챌린지가 아니에요.');
    found.joined = false;
    found.participantCount = Math.max(0, found.participantCount - 1);
    return noContent;
  }],
  ['GET', '/me/challenges/:challengeId/result', ({ now }) => ok(socialFx.challengeResult(now))],
  ['GET', '/me/challenges', ({ query, now, data }) => {
    const mine = data.challenges.filter((c) => c.joined).map(() => socialFx.myChallenge(now));
    return ok(query.status ? mine.filter((c) => c.status === query.status) : mine);
  }],

  // ── 08 §13 알림·공지·문의·구독 ─────────────────────────────────────
  ['GET', '/me/notifications', ({ query, data }) => {
    const items = query.unreadOnly === 'true' ? data.notifications.filter((n) => !n.readAt) : data.notifications;
    const unread = data.notifications.filter((n) => !n.readAt).length;
    return ok(page(items, query), { 'X-Unread-Count': String(unread) });
  }],
  ['POST', '/me/notifications/read-all', ({ now, data }) => {
    for (const n of data.notifications) n.readAt ??= new Date(now).toISOString();
    return noContent;
  }],
  ['POST', '/me/notifications/:notificationId/read', ({ params, now, data }) => {
    const found = data.notifications.find((n) => n.id === params.notificationId);
    if (found) found.readAt = new Date(now).toISOString();
    return noContent;
  }],
  ['GET', '/notices', ({ query, now }) => ok(page(supportFx.notices(now), query))],
  ['GET', '/notices/:noticeId', ({ params, now }) => {
    const found = supportFx.notices(now).find((n) => n.id === params.noticeId);
    return found ? ok(found) : error(404, 'COMMON_NOT_FOUND');
  }],
  ['POST', '/support-tickets', ({ body, now, data }) => {
    const made = {
      id: nextId('ticket'),
      ticketType: body.ticketType,
      category: body.category,
      subject: body.subject,
      body: body.body,
      status: 'received',
      receivedAt: new Date(now).toISOString(),
      completedAt: null,
      replies: [],
    };
    data.tickets.unshift(made);
    return created(made);
  }],
  ['GET', '/me/support-tickets', ({ query, data }) => ok(page(data.tickets, query))],
  ['GET', '/support-tickets/:ticketId', ({ params, data }) => {
    const found = data.tickets.find((t) => t.id === params.ticketId);
    return found ? ok(found) : error(404, 'COMMON_NOT_FOUND');
  }],
  ['GET', '/me/subscription', () => error(501, 'COMMON_NOT_IMPLEMENTED', '준비 중인 기능이에요.')],
];

/** 경로 패턴 맞추기. 맞으면 `params`, 아니면 `null`. */
function matchPath(pattern, path) {
  if (pattern === path) return {};
  const p = pattern.split('/');
  const a = path.split('/');
  if (p.length !== a.length) return null;
  const params = {};
  for (let i = 0; i < p.length; i += 1) {
    if (p[i].startsWith(':')) {
      if (a[i] === '') return null;
      params[p[i].slice(1)] = decodeURIComponent(a[i]);
    } else if (p[i] !== a[i]) {
      return null;
    }
  }
  return params;
}

export const mockServer = {
  /**
   * `httpClient`가 `fetch` 대신 부른다.
   * @param {{method: string, path: string, query?: object, body?: object, headers?: object}} request
   * @returns {Promise<{status: number, body: any, headers?: object}>}
   */
  async handle({ method, path, query = {}, body = null, headers = {} }) {
    const now = Date.now();
    const data = db(now);

    for (const [routeMethod, pattern, handler] of routes) {
      if (routeMethod !== method) continue;
      const params = matchPath(pattern, path);
      if (!params) continue;
      return handler({ params, query, body, headers, now, data });
    }

    return error(404, 'COMMON_NOT_FOUND', '찾을 수 없어요.');
  },

  /** 테스트·개발 중 상태를 처음으로. */
  reset() {
    store = null;
    sequence = 0;
  },

  /** 테스트에서 "08의 모든 GET에 응답이 있나"를 보기 위해. */
  get routes() {
    return routes.map(([method, pattern]) => `${method} ${pattern}`);
  },
};

export default mockServer;
