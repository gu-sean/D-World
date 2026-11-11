/**
 * I01 영상·사진 판정 요청 (AI 계약 VisionAnalysisRequest, ai/app/schemas/contracts.py)
 * 백엔드 내부 요청(AiDispatchService.buildRequest)을 AI가 받는 모양으로 바꾼다.
 */

/** 보낼 수 없는 회차: 다시 시도해도 같으므로 바로 관리자 검수로 넘긴다 */
export class UnsendableError extends Error {
  permanent = true;

  constructor(message) {
    super(message);
    this.name = 'UnsendableError';
  }
}

// AI TargetUnit 허용값, 그 밖의 단위(자유 입력)는 times로 보낸다
const TARGET_UNITS = new Set([
  'reps',
  'seconds',
  'times',
  'pages',
  'steps',
  'meters',
]);

const iso = (value) => new Date(value).toISOString();

/** 증거 파일 하나 고르기: AI는 media를 정확히 1개만 받는다(영상 우선, 없으면 사진) */
export function pickMedia(files = []) {
  return (
    files.find((file) => file.mediaKind === 'camera_video') ??
    files.find((file) => file.mediaKind === 'camera_photo') ??
    null
  );
}

/**
 * @param {{mediaAccess?: 'object_key'|'signed_url'}} options
 *   signed_url이면 media에 읽기용 서명 URL(downloadUrl)을 더한다. 현재 AI 스키마(extra=forbid)는
 *   이 필드를 받지 않으므로 AI가 `downloadUrl`을 추가한 뒤에 켠다.
 */
export function toVisionAnalysisRequest(
  request,
  callbackUrl,
  { mediaAccess = 'object_key' } = {},
) {
  if (request.verificationMethod !== 'camera') {
    throw new UnsendableError('센서 인증은 I01 대상이 아님(I02 구현 전)');
  }
  const media = pickMedia(request.files);
  if (!media) throw new UnsendableError('보낼 영상·사진이 없음');
  if (!media.objectKey) throw new UnsendableError('파일의 저장소 키가 없음');
  if (!media.checksumSha256) {
    throw new UnsendableError(
      '파일 체크섬이 없어 AI가 무결성을 확인할 수 없음',
    );
  }
  if (!request.criteria) throw new UnsendableError('판정 기준이 없음');

  const video = media.mediaKind === 'camera_video';
  if (video && !request.exerciseCode) {
    throw new UnsendableError('운동 영상 미션에 운동 종류가 없음');
  }

  const targetValue = Number(request.targetValue);
  return {
    ingestKey: `vision:${request.recordId}:${request.submissionNo}`,
    recordId: request.recordId,
    missionId: request.missionId,
    submissionNo: request.submissionNo,
    categoryCode: request.categoryCode,
    exerciseCode: video ? request.exerciseCode : null,
    targetValue: targetValue > 0 ? targetValue : 1,
    targetUnit: TARGET_UNITS.has(request.targetUnit)
      ? request.targetUnit
      : 'times',
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
    recordStartedAt: iso(request.recordStartedAt),
    submittedAt: iso(request.submittedAt),
    duplicateOfMediaId: null,
    criteria: {
      versionId: request.criteria.versionId,
      rules: request.criteria.rules ?? {},
    },
    callbackUrl,
  };
}
