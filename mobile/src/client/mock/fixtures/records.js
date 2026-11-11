/**
 * 수행 인증 가짜 응답 (A40~A46). 07 §8 모양.
 *
 * 판정은 제출하고 **6초 뒤**에 붙는다 (tasks/mobile-client MC-05).
 * 결과는 개발용 AI 드라이버(`fixed`, 12 §9 · 10 §7)와 같게 목표값 끝자리로 정한다:
 * 3 → 거절, 4 → 검수 필요, 그 외 → 승인.
 */

/** 제출 후 판정이 붙기까지 (ms). */
export const DECISION_DELAY_MS = 6000;

/**
 * 목표값으로 판정을 정한다 (12 §9).
 * @param {number|null} targetValue
 * @returns {'approved'|'rejected'|'review_required'}
 */
export function decisionFor(targetValue) {
  const lastDigit = Math.abs(Math.trunc(Number(targetValue) || 0)) % 10;
  if (lastDigit === 3) return 'rejected';
  if (lastDigit === 4) return 'review_required';
  return 'approved';
}

/** `VerificationMetrics` — 모든 키가 항상 있고, 해당 없으면 null (07 §8) */
export function metrics(mission, decision) {
  const isRunning = mission?.exerciseCode === 'running';
  const isCamera = Boolean(mission?.exerciseCode) && !isRunning;
  const target = Number(mission?.targetValue ?? 0);
  return {
    exerciseCode: mission?.exerciseCode ?? null,
    repCount: isCamera && mission.targetUnit === 'reps' ? target : null,
    validRepCount: isCamera && mission.targetUnit === 'reps' ? (decision === 'rejected' ? Math.floor(target / 2) : target) : null,
    invalidRepCount: isCamera && mission.targetUnit === 'reps' ? (decision === 'rejected' ? Math.ceil(target / 2) : 0) : null,
    holdSeconds: isCamera && mission.targetUnit === 'seconds' ? target : null,
    accuracy: isCamera ? 0.92 : null,
    durationSeconds: isRunning ? 1500 : (isCamera ? 60 : null),
    personDetected: isCamera ? true : null,
    distanceMeters: isRunning ? target : null,
    activeSeconds: isRunning ? 1450 : null,
    avgPaceSecondsPerKm: isRunning ? 480 : null,
    steps: isRunning ? 3950 : null,
    avgCadenceSpm: isRunning ? 163 : null,
    validPointRatio: isRunning ? 0.96 : null,
    mockLocationDetected: isRunning ? false : null,
    mediaSha256: 'f'.repeat(64),
    flags: decision === 'rejected' ? ['target_not_met'] : [],
    issues: [],
  };
}

const REASONS = {
  approved: '잘 하셨어요! 목표를 채웠어요.',
  rejected: '목표 횟수를 채우지 못했어요.',
  review_required: '자동으로 판단하기 어려워 관리자가 확인할 예정이에요.',
};

/** `VerificationResult` */
export function verificationResult(mission, decision, nowMs = Date.now()) {
  return {
    id: 'result-0001',
    resultNo: 1,
    source: 'ai',
    decision,
    confidence: decision === 'review_required' ? 0.55 : 0.93,
    reason: REASONS[decision],
    engineVersion: 'mock-fixed@0.1.0',
    metrics: metrics(mission, decision),
    decidedAt: new Date(nowMs).toISOString(),
  };
}

/** `GrantedRewards` (승인일 때만) */
export function grantedRewards(mission) {
  const preview = mission?.rewardPreview ?? { points: 50, userXp: 30, petXp: 20 };
  return {
    points: preview.points,
    pointsCapped: false,
    userXp: preview.userXp,
    petXp: preview.petXp,
    petId: 'pet-0001',
    levelUp: false,
    newLevelNo: null,
    petEvolved: false,
    streakDays: 6,
    newBadges: [],
  };
}

/** `MissionRecord` */
export function missionRecord(record, mission, nowMs = Date.now()) {
  const decided = record.decision !== null && record.decision !== undefined;
  const result = decided ? verificationResult(mission, record.decision, nowMs) : null;
  return {
    id: record.id,
    missionId: record.missionId,
    attemptNo: record.attemptNo,
    submissionNo: record.submissionNo ?? null,
    status: record.status,
    evidenceKind: record.evidenceKind ?? null,
    startedAt: new Date(record.startedAtMs).toISOString(),
    submittedAt: record.submittedAtMs ? new Date(record.submittedAtMs).toISOString() : null,
    completedAt: decided ? new Date(nowMs).toISOString() : null,
    media: record.media ?? [],
    currentResult: result,
    mission: {
      id: record.missionId,
      status: decided
        ? (record.decision === 'approved' ? 'completed' : (record.decision === 'rejected' ? 'failed' : 'submitted'))
        : (record.status === 'submitted' ? 'submitted' : 'in_progress'),
      remainingSubmissions: Math.max(0, 4 - (record.submissionNo ?? 0)),
    },
    rewards: record.decision === 'approved' ? grantedRewards(mission) : null,
    canAppeal: record.decision === 'rejected',
    pollAfterMs: decided ? null : 2000,
  };
}

export default {
  DECISION_DELAY_MS,
  decisionFor,
  metrics,
  verificationResult,
  grantedRewards,
  missionRecord,
};
