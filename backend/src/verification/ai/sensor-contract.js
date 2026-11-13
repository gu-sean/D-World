import { parseCallback } from './ai-callback-input.js';
import { UnsendableError } from './vision-contract.js';

/**
 * I02 러닝 센서 판정 요청 (AI 계약 SensorEvaluationRequest, ai/app/schemas/contracts.py)
 * 영상(I01)과 달리 동기 호출: AI가 파일을 저장소 키로 내려받아 평가하고 결과를 응답으로 돌려준다.
 */

const SENSOR_UNITS = new Set(['meters', 'seconds']);
const CLIENT_METRIC_KEYS = [
  'distanceMeters',
  'activeSeconds',
  'steps',
  'videoDurationSeconds',
  'onDeviceRepCount',
];

const iso = (value) => new Date(value).toISOString();

/** 앱이 보낸 기록 지표 중 AI 계약에 있는 키만 (AI는 모르는 키를 거부) */
function clientMetricsOf(metrics) {
  if (!metrics || typeof metrics !== 'object') return null;
  const picked = {};
  for (const key of CLIENT_METRIC_KEYS) {
    if (typeof metrics[key] === 'number') picked[key] = metrics[key];
  }
  if (Object.keys(picked).length === 0) return null;
  const appVersion =
    typeof metrics.appVersion === 'string' && metrics.appVersion
      ? metrics.appVersion
      : 'unknown';
  return { ...picked, appVersion };
}

/**
 * @param {{mediaAccess?: 'object_key'|'signed_url'}} options
 * @throws {UnsendableError} 보낼 수 없는 회차 (다시 보내도 같으므로 관리자 검수)
 */
export function toSensorEvaluationRequest(
  request,
  { mediaAccess = 'object_key' } = {},
) {
  if (request.verificationMethod !== 'sensor') {
    throw new UnsendableError('센서 인증이 아님');
  }
  if (request.exerciseCode !== 'running') {
    throw new UnsendableError('센서 판정은 러닝만 지원');
  }
  const media = request.files.find((file) => file.mediaKind === 'sensor_raw');
  if (!media) throw new UnsendableError('보낼 센서 기록 파일이 없음');
  if (!media.objectKey) throw new UnsendableError('파일의 저장소 키가 없음');
  if (!media.checksumSha256) {
    throw new UnsendableError(
      '파일 체크섬이 없어 AI가 무결성을 확인할 수 없음',
    );
  }
  if (!request.criteria) throw new UnsendableError('판정 기준이 없음');
  const targetValue = Number(request.targetValue);
  if (!(targetValue > 0) || !SENSOR_UNITS.has(request.targetUnit)) {
    throw new UnsendableError('러닝 목표(거리·시간)가 없음');
  }

  return {
    ingestKey: `sensor:${request.recordId}:${request.submissionNo}`,
    recordId: request.recordId,
    exerciseCode: 'running',
    targetValue,
    targetUnit: request.targetUnit,
    recordStartedAt: iso(request.recordStartedAt),
    submittedAt: iso(request.submittedAt),
    media: [
      {
        mediaId: media.id,
        objectKey: media.objectKey,
        mimeType: media.mimeType,
        mediaKind: media.mediaKind,
        sizeBytes: media.sizeBytes,
        checksumSha256: media.checksumSha256.toLowerCase(),
        ...(mediaAccess === 'signed_url' && media.url
          ? { downloadUrl: media.url }
          : {}),
      },
    ],
    clientMetrics: clientMetricsOf(request.metrics),
    duplicateOfMediaId: null,
    criteria: {
      versionId: request.criteria.versionId,
      rules: request.criteria.rules ?? {},
    },
  };
}

/**
 * AI의 SensorEvaluationResponse를 콜백(parseCallback)과 같은 입력으로 바꿔 같은 반영 경로를 쓴다
 * @throws {BadRequestException} 응답 형식이 계약과 다름
 */
export function sensorResponseToDecisionInput(recordId, response) {
  return parseCallback({
    ...(response ?? {}),
    recordId,
    status: 'completed',
    rawResult: response ?? {},
  });
}
