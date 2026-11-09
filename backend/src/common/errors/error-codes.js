/**
 * 오류 코드 표 (팀 문서 05 §7이 정본)
 * 형식: CODE: [HTTP 상태, 한국어 문구]
 */
export const ERROR_CODES = {
  // 7.1 공통
  COMMON_VALIDATION_FAILED: [400, '입력한 내용을 다시 확인해 주세요.'],
  COMMON_UNAUTHORIZED: [401, '로그인이 필요해요.'],
  COMMON_FORBIDDEN: [403, '권한이 없어요.'],
  COMMON_NOT_FOUND: [404, '찾을 수 없어요.'],
  COMMON_CONFLICT: [409, '지금은 처리할 수 없어요. 새로고침해 주세요.'],
  COMMON_IDEMPOTENCY_KEY_REUSED: [
    409,
    '같은 요청이 다른 내용으로 이미 처리됐어요.',
  ],
  COMMON_REQUEST_IN_PROGRESS: [
    409,
    '요청을 처리하고 있어요. 잠시만 기다려 주세요.',
  ],
  COMMON_RATE_LIMITED: [429, '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.'],
  COMMON_INTERNAL: [500, '잠시 후 다시 시도해 주세요.'],
  COMMON_NOT_IMPLEMENTED: [501, '준비 중인 기능이에요.'],
  // 7.2 계정
  AUTH_INVALID_CREDENTIALS: [401, '휴대폰 번호 또는 비밀번호가 맞지 않아요.'],
  AUTH_LOGIN_LOCKED: [403, '5번 틀려서 5분 동안 로그인할 수 없어요.'],
  AUTH_TOKEN_EXPIRED: [401, '로그인 시간이 지났어요.'],
  AUTH_REFRESH_INVALID: [401, '다시 로그인해 주세요.'],
  AUTH_SMS_SEND_FAILED: [
    502,
    '인증번호를 보내지 못했어요. 잠시 후 다시 시도해 주세요.',
  ],
  AUTH_SMS_RESEND_TOO_SOON: [429, '잠시 후 다시 받을 수 있어요.'],
  AUTH_SMS_DAILY_LIMIT: [429, '오늘은 인증번호를 더 받을 수 없어요.'],
  AUTH_OTP_INVALID: [400, '인증번호가 맞지 않아요.'],
  AUTH_OTP_EXPIRED: [400, '인증번호가 만료됐어요. 다시 받아 주세요.'],
  AUTH_VERIFICATION_TOKEN_INVALID: [
    400,
    '인증 시간이 지났어요. 처음부터 다시 진행해 주세요.',
  ],
  AUTH_PHONE_ALREADY_REGISTERED: [409, '이미 가입한 휴대폰 번호예요.'],
  AUTH_SOCIAL_ACCOUNT_EXISTS: [409, '이미 가입한 소셜 계정이에요.'],
  AUTH_SOCIAL_FAILED: [502, '소셜 로그인에 실패했어요.'],
  AUTH_NICKNAME_INVALID: [400, '닉네임은 한글·영문·숫자 2~12자예요.'],
  AUTH_NICKNAME_TAKEN: [409, '이미 쓰고 있는 닉네임이에요.'],
  AUTH_PASSWORD_POLICY: [400, '비밀번호는 10~64자로 입력해 주세요.'],
  AUTH_RESET_TOKEN_EXPIRED: [
    400,
    '재설정 가능 시간이 지났어요. 다시 인증해 주세요.',
  ],
  AUTH_ACCOUNT_RESTRICTED: [403, '이용이 제한된 계정이에요.'],
  AUTH_CONSENT_REQUIRED: [403, '필수 약관에 동의해 주세요.'],
  ACCOUNT_WITHDRAWAL_ALREADY_REQUESTED: [409, '이미 탈퇴를 신청했어요.'],
  // 7.3 목표·계획·미션
  GOAL_INVALID_PERIOD: [400, '기간을 다시 확인해 주세요.'],
  GOAL_LIMIT_REACHED: [409, '진행 중인 목표는 10개까지 만들 수 있어요.'],
  GOAL_ALREADY_COMPLETED: [409, '이미 끝난 목표예요.'],
  PLAN_ALREADY_ACCEPTED: [
    409,
    '이미 계획을 정했어요. 계획 조정을 이용해 주세요.',
  ],
  PLAN_PROPOSAL_OUTDATED: [409, '더 새로운 제안이 있어요. 새로고침해 주세요.'],
  PLAN_PROPOSAL_NOT_DRAFT: [409, '이미 처리한 제안이에요.'],
  PLAN_INVALID: [422, '계획에 맞지 않는 부분이 있어요.'],
  PLAN_ADJUSTMENT_NOT_OPEN: [409, '이미 처리했거나 기간이 지난 제안이에요.'],
  MISSION_LOCKED_AFTER_START: [409, '시작한 미션은 고칠 수 없어요.'],
  MISSION_CHALLENGE_LOCKED: [409, '챌린지 미션은 고칠 수 없어요.'],
  MISSION_TARGET_OUT_OF_RANGE: [400, '목표 값이 허용 범위를 벗어났어요.'],
  MISSION_DATE_OUT_OF_RANGE: [400, '목표 기간 안의 날짜를 골라 주세요.'],
  MISSION_DEFINITION_UNAVAILABLE: [403, '지금은 쓸 수 없는 미션이에요.'],
  MISSION_NOT_STARTABLE: [409, '지금은 시작할 수 없는 미션이에요.'],
  // 7.4 인증·파일
  VERIFY_RECORD_NOT_OPEN: [409, '이미 제출했거나 끝난 기록이에요.'],
  VERIFY_EVIDENCE_REQUIRED: [422, '업로드를 먼저 끝내 주세요.'],
  VERIFY_EVIDENCE_KIND_MISMATCH: [422, '이 미션에 맞지 않는 인증 방식이에요.'],
  VERIFY_SUBMISSION_LIMIT: [422, '이 미션은 4번까지 제출할 수 있어요.'],
  VERIFY_APPEAL_NOT_ALLOWED: [422, '이의 제기할 수 없는 결과예요.'],
  VERIFY_APPEAL_WINDOW_CLOSED: [
    422,
    '결과를 받은 지 7일이 지나 이의 제기할 수 없어요.',
  ],
  VERIFY_APPEAL_DUPLICATE: [409, '이미 이의 제기했어요.'],
  MEDIA_TYPE_NOT_ALLOWED: [400, '지원하지 않는 파일 형식이에요.'],
  MEDIA_TOO_LARGE: [400, '파일이 너무 커요.'],
  MEDIA_ALREADY_UPLOADED: [409, '이미 파일을 올렸어요.'],
  MEDIA_UPLOAD_URL_EXPIRED: [
    410,
    '업로드 시간이 지났어요. 다시 시도해 주세요.',
  ],
  MEDIA_NOT_UPLOADED: [422, '파일이 올라가지 않았어요. 다시 시도해 주세요.'],
  // 7.5 보상·펫·챌린지
  POINT_INSUFFICIENT: [422, '포인트가 부족해요.'],
  SHOP_ITEM_UNAVAILABLE: [409, '지금은 살 수 없는 상품이에요.'],
  SHOP_PRICE_CHANGED: [409, '가격이 바뀌었어요. 새로고침해 주세요.'],
  SHOP_ALREADY_OWNED: [409, '이미 가지고 있는 상품이에요.'],
  ACHIEVEMENT_NOT_EARNED: [409, '아직 얻지 못한 업적이에요.'],
  PET_NICKNAME_INVALID: [400, '별명은 한글·영문 2~10자예요.'],
  PET_NICKNAME_TAKEN: [409, '이미 쓰고 있는 별명이에요.'],
  PET_SPECIES_LOCKED: [403, '아직 만날 수 없는 펫이에요.'],
  PET_ALREADY_OWNED: [409, '이미 함께하고 있는 펫이에요.'],
  RECOMMENDATION_RATE_LIMITED: [429, '추천은 10분에 한 번 받을 수 있어요.'],
  RECOMMENDATION_EXPIRED: [410, '추천 시간이 지났어요.'],
  RECOMMENDATION_NOT_OPEN: [409, '이미 처리한 추천이에요.'],
  CHALLENGE_NOT_OPEN: [409, '지금은 참여할 수 없는 챌린지예요.'],
  CHALLENGE_FULL: [409, '정원이 다 찼어요.'],
  CHALLENGE_ALREADY_JOINED: [409, '이미 참여한 챌린지예요.'],
  CHALLENGE_NOT_JOINED: [409, '참여 중인 챌린지가 아니에요.'],
  SUPPORT_DUPLICATE_REPORT: [409, '이미 신고한 대상이에요.'],
  // 7.6 AI·관리자
  AI_INVALID_REQUEST: [400, '잘못된 AI 요청이에요.'],
  AI_MEDIA_UNAVAILABLE: [422, 'AI가 인증 파일을 읽지 못했어요.'],
  AI_LLM_UNAVAILABLE: [
    503,
    'AI가 잠시 쉬고 있어요. 잠시 후 다시 시도해 주세요.',
  ],
  AI_TIMEOUT: [504, 'AI 응답이 늦어요. 다시 시도해 주세요.'],
  AI_INVALID_OUTPUT: [502, '계획을 만들지 못했어요. 다시 시도해 주세요.'],
  ADMIN_REASON_REQUIRED: [400, '사유를 입력해 주세요.'],
  ADMIN_STATE_CONFLICT: [409, '지금 상태에서는 할 수 없는 작업이에요.'],
  ADMIN_ACTION_CONFLICT: [409, '이미 진행 중인 이용 제한이 있어요.'],
  VERIFY_SAME_DECISION: [409, '현재 판정과 같아요.'],
  CRITERIA_RULES_INVALID: [400, '판정 기준 형식이 맞지 않아요.'],
  CATALOG_IN_USE: [409, '사용 중이라 끌 수 없어요.'],
  CHALLENGE_NOT_ENDED: [409, '아직 정산할 수 없어요.'],
};

/**
 * 서비스 내부 코드 → 팀 코드
 * 표에 없는 도메인 코드는 대문자로 바꿔 그대로 노출(상태·문구는 던진 쪽 값)
 */
const LEGACY_CODE_MAP = {
  // 공통
  bad_request: 'COMMON_VALIDATION_FAILED',
  unauthorized: 'COMMON_UNAUTHORIZED',
  forbidden: 'COMMON_FORBIDDEN',
  not_found: 'COMMON_NOT_FOUND',
  conflict: 'COMMON_CONFLICT',
  too_many_requests: 'COMMON_RATE_LIMITED',
  internal_error: 'COMMON_INTERNAL',
  unprocessable: 'COMMON_VALIDATION_FAILED',
  unavailable: 'COMMON_CONFLICT',
  invalid: 'COMMON_VALIDATION_FAILED',
  idempotency_key_reused: 'COMMON_IDEMPOTENCY_KEY_REUSED',
  request_in_progress: 'COMMON_REQUEST_IN_PROGRESS',
  idempotency_key_required: 'COMMON_VALIDATION_FAILED',
  admin_reason_required: 'ADMIN_REASON_REQUIRED',
  // 계정
  invalid_credentials: 'AUTH_INVALID_CREDENTIALS',
  account_locked: 'AUTH_LOGIN_LOCKED',
  token_expired: 'AUTH_TOKEN_EXPIRED',
  invalid_refresh_token: 'AUTH_REFRESH_INVALID',
  sms_unavailable: 'AUTH_SMS_SEND_FAILED',
  code_rate_limited: 'AUTH_SMS_RESEND_TOO_SOON',
  code_invalid: 'AUTH_OTP_INVALID',
  code_expired: 'AUTH_OTP_EXPIRED',
  phone_taken: 'AUTH_PHONE_ALREADY_REGISTERED',
  phone_already_linked: 'AUTH_PHONE_ALREADY_REGISTERED',
  identity_already_linked: 'AUTH_SOCIAL_ACCOUNT_EXISTS',
  invalid_social_token: 'AUTH_SOCIAL_FAILED',
  social_unavailable: 'AUTH_SOCIAL_FAILED',
  nickname_taken: 'AUTH_NICKNAME_TAKEN',
  account_restricted: 'AUTH_ACCOUNT_RESTRICTED',
  consent_required: 'AUTH_CONSENT_REQUIRED',
  reconsent_required: 'AUTH_CONSENT_REQUIRED',
  // 목표·계획·미션
  invalid_period: 'GOAL_INVALID_PERIOD',
  goal_limit_reached: 'GOAL_LIMIT_REACHED',
  goal_completed: 'GOAL_ALREADY_COMPLETED',
  draft_stale: 'PLAN_PROPOSAL_OUTDATED',
  adjustment_not_open: 'PLAN_ADJUSTMENT_NOT_OPEN',
  proposal_not_open: 'PLAN_PROPOSAL_NOT_DRAFT',
  plan_too_large: 'PLAN_INVALID',
  steps_outside_period: 'PLAN_INVALID',
  missions_outside_period: 'PLAN_INVALID',
  mission_started: 'MISSION_LOCKED_AFTER_START',
  challenge_mission_locked: 'MISSION_CHALLENGE_LOCKED',
  date_out_of_range: 'MISSION_DATE_OUT_OF_RANGE',
  mission_not_startable: 'MISSION_NOT_STARTABLE',
  // 인증·파일
  record_not_open: 'VERIFY_RECORD_NOT_OPEN',
  evidence_required: 'VERIFY_EVIDENCE_REQUIRED',
  exercise_method_mismatch: 'VERIFY_EVIDENCE_KIND_MISMATCH',
  criteria_mismatch: 'VERIFY_EVIDENCE_KIND_MISMATCH',
  submission_limit_reached: 'VERIFY_SUBMISSION_LIMIT',
  appeal_not_allowed: 'VERIFY_APPEAL_NOT_ALLOWED',
  appeal_window_closed: 'VERIFY_APPEAL_WINDOW_CLOSED',
  appeal_already_filed: 'VERIFY_APPEAL_DUPLICATE',
  unsupported_media: 'MEDIA_TYPE_NOT_ALLOWED',
  media_already_uploaded: 'MEDIA_ALREADY_UPLOADED',
  media_not_uploaded: 'MEDIA_NOT_UPLOADED',
  upload_incomplete: 'MEDIA_NOT_UPLOADED',
  // 보상·펫·챌린지
  insufficient_points: 'POINT_INSUFFICIENT',
  item_unavailable: 'SHOP_ITEM_UNAVAILABLE',
  price_changed: 'SHOP_PRICE_CHANGED',
  pet_nickname_taken: 'PET_NICKNAME_TAKEN',
  pet_locked: 'PET_SPECIES_LOCKED',
  pet_already_owned: 'PET_ALREADY_OWNED',
  challenge_not_open: 'CHALLENGE_NOT_OPEN',
  enrollment_closed: 'CHALLENGE_NOT_OPEN',
  challenge_full: 'CHALLENGE_FULL',
  already_joined: 'CHALLENGE_ALREADY_JOINED',
  not_enrolled: 'CHALLENGE_NOT_JOINED',
  challenge_not_ended: 'CHALLENGE_NOT_ENDED',
  // 관리자
  invalid_transition: 'ADMIN_STATE_CONFLICT',
  settlement_not_draft: 'ADMIN_STATE_CONFLICT',
  settlement_not_confirmed: 'ADMIN_STATE_CONFLICT',
  challenge_settled: 'ADMIN_STATE_CONFLICT',
  challenge_settling: 'ADMIN_STATE_CONFLICT',
  participation_final: 'ADMIN_STATE_CONFLICT',
  day_not_excluded: 'ADMIN_STATE_CONFLICT',
};

const COMMON_BY_STATUS = {
  400: 'COMMON_VALIDATION_FAILED',
  401: 'COMMON_UNAUTHORIZED',
  403: 'COMMON_FORBIDDEN',
  404: 'COMMON_NOT_FOUND',
  409: 'COMMON_CONFLICT',
  429: 'COMMON_RATE_LIMITED',
  501: 'COMMON_NOT_IMPLEMENTED',
};

/**
 * (서비스 코드, 던진 상태) → { code, status, message }
 * message가 null이면 던진 쪽 문구를 유지
 */
export function resolveCode(legacyCode, status) {
  const code =
    LEGACY_CODE_MAP[legacyCode] ??
    (ERROR_CODES[legacyCode] ? legacyCode : undefined);
  if (code) {
    const [tableStatus, message] = ERROR_CODES[code];
    // 공통 코드는 던진 상태를 유지(예: 422 규칙 위반), 그 외는 표의 상태·문구
    if (code.startsWith('COMMON_') && status !== tableStatus) {
      return { code, status, message: null };
    }
    return { code, status: tableStatus, message };
  }
  if (legacyCode)
    return { code: legacyCode.toUpperCase(), status, message: null };
  return {
    code: COMMON_BY_STATUS[status] ?? 'COMMON_INTERNAL',
    status,
    message: null,
  };
}
