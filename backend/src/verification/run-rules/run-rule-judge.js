import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { judgeRun, RUN_RULE_VERSION } from './run-rules.js';

/**
 * 러닝 기록을 서버가 규칙으로 판정 (AI 서버의 러닝 판정 대신).
 * AI_SENSOR_ENABLED=false인 동안 센서(러닝) 회차는 여기서 판정하고, 판정 결과 표에는
 * source='ai', engineVersion='run-rule@…'로 남는다 (판정 출처 칸은 ai·admin 두 값뿐이라 DB를 바꾸지 않는다).
 */

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export class RunRuleError extends Error {
  permanent = true;
}

/** 이 회차를 규칙 판정으로 처리하는지 */
export function isRuleJudged(candidate, config) {
  return (
    candidate.verification_method === 'sensor' &&
    candidate.exercise_code === 'running' &&
    config.get('AI_SENSOR_ENABLED') !== true
  );
}

/** 서명 URL로 기록 파일을 받아 풀어 읽는다 */
export async function loadRunFile(file, { fetchImpl = fetch } = {}) {
  if (!file?.url) throw new RunRuleError('기록 파일 주소가 없음');
  let response;
  try {
    response = await fetchImpl(file.url);
  } catch (error) {
    // 저장소에 닿지 못함: 잠시 뒤 다시 시도
    const retry = new Error(`기록 파일을 받지 못함: ${error.message}`);
    retry.permanent = false;
    throw retry;
  }
  if (!response.ok) throw new RunRuleError(`기록 파일 응답 ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_FILE_BYTES)
    throw new RunRuleError('기록 파일이 너무 큼');
  if (file.checksumSha256) {
    const actual = createHash('sha256').update(buffer).digest('hex');
    if (actual !== file.checksumSha256.toLowerCase()) {
      throw new RunRuleError('기록 파일 체크섬이 다름');
    }
  }
  let parsed;
  try {
    parsed = JSON.parse(gunzipSync(buffer).toString('utf8'));
  } catch {
    throw new RunRuleError('기록 파일을 읽을 수 없음');
  }
  if (parsed?.format !== 'dworld-run' || !Array.isArray(parsed.points)) {
    throw new RunRuleError('러닝 기록 형식이 아님');
  }
  return parsed;
}

const round = (v, digits = 0) =>
  v === null || v === undefined ? null : Number(v.toFixed(digits));

/**
 * 회차 요청(AiDispatchService.buildRequest)으로 판정 입력을 만든다 (DecisionService.applyDecision 입력)
 */
export async function judgeRunRecord(
  request,
  { weightKg = null, fetchImpl } = {},
) {
  const file = request.files.find((f) => f.mediaKind === 'sensor_raw');
  if (!file) throw new RunRuleError('러닝 기록 파일이 없음');
  const unit = request.targetUnit;
  const targetValue = Number(request.targetValue);
  if (!(targetValue > 0) || !['meters', 'seconds'].includes(unit)) {
    throw new RunRuleError('러닝 목표(거리·시간)가 없음');
  }
  const runFile = await loadRunFile(file, { fetchImpl });
  const judged = judgeRun(runFile, { targetValue, targetUnit: unit, weightKg });
  const s = judged.summary;
  const metrics = {
    exerciseCode: 'running',
    distanceMeters: round(s.validMeters, 1),
    activeSeconds: round(s.activeSeconds),
    steps: s.steps,
    avgPaceSecondsPerKm: round(s.paceSecondsPerKm),
    avgCadenceSpm: round(s.avgCadenceSpm),
    validPointRatio: round(s.validPointRatio, 3),
    mockLocationDetected: s.mockedPoints > 0,
    vehicleMeters: round(s.vehicleMeters, 1),
    vehicleRatio: round(s.vehicleRatio, 3),
    calories: round(s.calories),
    personDetected: null,
    flags: judged.flags,
    issues: [],
  };
  return {
    ingestKey: `run-rule:${request.recordId}:${request.submissionNo}`,
    recordId: request.recordId,
    status: 'completed',
    decision: judged.decision,
    engineVersion: RUN_RULE_VERSION,
    confidence: judged.confidence,
    reason: judged.reason,
    metrics,
    criteriaVersionId: request.criteria?.versionId ?? undefined,
    rawResult: {
      engineVersion: RUN_RULE_VERSION,
      summary: s,
      windows: judged.windows.map((w) => ({
        from: w.from,
        to: w.to,
        kind: w.kind,
        reason: w.reason,
        meters: round(w.meters, 1),
        speed: round(w.speed, 2),
        cadence: round(w.cadence),
        amp: w.motion ? round(w.motion.amp, 3) : null,
      })),
    },
  };
}
