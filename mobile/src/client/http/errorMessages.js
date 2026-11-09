/**
 * 오류 코드 → 화면에 보여 줄 한국어 문구.
 *
 * 05 §7.1~§7.6의 표를 **그대로** 옮긴 것이다. 문구를 고치려면 05를 먼저 고친다.
 * §7.7(앱 전용 코드)의 문구는 parts/mobile-client §3.3에 있다.
 *
 * 서버가 `message`를 보내 주면 그 값을 쓰고, 이 표는 서버 문구가 없을 때만 쓴다
 * (`AppError`가 그렇게 고른다).
 */

/** @type {Record<string, string>} */
export const errorMessages = {
  // 05 §7.1 공통
  COMMON_VALIDATION_FAILED: '입력한 내용을 다시 확인해 주세요.',
  COMMON_UNAUTHORIZED: '로그인이 필요해요.',
  COMMON_FORBIDDEN: '권한이 없어요.',
  COMMON_NOT_FOUND: '찾을 수 없어요.',
  COMMON_CONFLICT: '지금은 처리할 수 없어요. 새로고침해 주세요.',
  COMMON_IDEMPOTENCY_KEY_REUSED: '같은 요청이 다른 내용으로 이미 처리됐어요.',
  COMMON_REQUEST_IN_PROGRESS: '요청을 처리하고 있어요. 잠시만 기다려 주세요.',
  COMMON_RATE_LIMITED: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.',
  COMMON_INTERNAL: '잠시 후 다시 시도해 주세요.',
  COMMON_NOT_IMPLEMENTED: '준비 중인 기능이에요.',

  // 05 §7.2 계정
  AUTH_INVALID_CREDENTIALS: '휴대폰 번호 또는 비밀번호가 맞지 않아요.',
  AUTH_LOGIN_LOCKED: '5번 틀려서 5분 동안 로그인할 수 없어요.',
  AUTH_TOKEN_EXPIRED: '로그인 시간이 지났어요.',
  AUTH_REFRESH_INVALID: '다시 로그인해 주세요.',
  AUTH_SMS_SEND_FAILED: '인증번호를 보내지 못했어요. 잠시 후 다시 시도해 주세요.',
  AUTH_SMS_RESEND_TOO_SOON: '잠시 후 다시 받을 수 있어요.',
  AUTH_SMS_DAILY_LIMIT: '오늘은 인증번호를 더 받을 수 없어요.',
  AUTH_OTP_INVALID: '인증번호가 맞지 않아요.',
  AUTH_OTP_EXPIRED: '인증번호가 만료됐어요. 다시 받아 주세요.',
  AUTH_VERIFICATION_TOKEN_INVALID: '인증 시간이 지났어요. 처음부터 다시 진행해 주세요.',
  AUTH_PHONE_ALREADY_REGISTERED: '이미 가입한 휴대폰 번호예요.',
  AUTH_SOCIAL_ACCOUNT_EXISTS: '이미 가입한 소셜 계정이에요.',
  AUTH_SOCIAL_FAILED: '소셜 로그인에 실패했어요.',
  AUTH_NICKNAME_INVALID: '닉네임은 한글·영문·숫자 2~12자예요.',
  AUTH_NICKNAME_TAKEN: '이미 쓰고 있는 닉네임이에요.',
  AUTH_PASSWORD_POLICY: '비밀번호는 10~64자로 입력해 주세요.',
  AUTH_RESET_TOKEN_EXPIRED: '재설정 가능 시간이 지났어요. 다시 인증해 주세요.',
  AUTH_ACCOUNT_RESTRICTED: '이용이 제한된 계정이에요.',
  AUTH_CONSENT_REQUIRED: '필수 약관에 동의해 주세요.',
  ACCOUNT_WITHDRAWAL_ALREADY_REQUESTED: '이미 탈퇴를 신청했어요.',

  // 05 §7.3 목표·계획·미션
  GOAL_INVALID_PERIOD: '기간을 다시 확인해 주세요.',
  GOAL_LIMIT_REACHED: '진행 중인 목표는 10개까지 만들 수 있어요.',
  GOAL_ALREADY_COMPLETED: '이미 끝난 목표예요.',
  PLAN_ALREADY_ACCEPTED: '이미 계획을 정했어요. 계획 조정을 이용해 주세요.',
  PLAN_PROPOSAL_OUTDATED: '더 새로운 제안이 있어요. 새로고침해 주세요.',
  PLAN_PROPOSAL_NOT_DRAFT: '이미 처리한 제안이에요.',
  PLAN_INVALID: '계획에 맞지 않는 부분이 있어요.',
  PLAN_ADJUSTMENT_NOT_OPEN: '이미 처리했거나 기간이 지난 제안이에요.',
  MISSION_LOCKED_AFTER_START: '시작한 미션은 고칠 수 없어요.',
  MISSION_CHALLENGE_LOCKED: '챌린지 미션은 고칠 수 없어요.',
  MISSION_TARGET_OUT_OF_RANGE: '목표 값이 허용 범위를 벗어났어요.',
  MISSION_DATE_OUT_OF_RANGE: '목표 기간 안의 날짜를 골라 주세요.',
  MISSION_DEFINITION_UNAVAILABLE: '지금은 쓸 수 없는 미션이에요.',
  MISSION_NOT_STARTABLE: '지금은 시작할 수 없는 미션이에요.',

  // 05 §7.4 인증·파일
  VERIFY_RECORD_NOT_OPEN: '이미 제출했거나 끝난 기록이에요.',
  VERIFY_EVIDENCE_REQUIRED: '업로드를 먼저 끝내 주세요.',
  VERIFY_EVIDENCE_KIND_MISMATCH: '이 미션에 맞지 않는 인증 방식이에요.',
  VERIFY_SUBMISSION_LIMIT: '이 미션은 4번까지 제출할 수 있어요.',
  VERIFY_APPEAL_NOT_ALLOWED: '이의 제기할 수 없는 결과예요.',
  VERIFY_APPEAL_WINDOW_CLOSED: '결과를 받은 지 7일이 지나 이의 제기할 수 없어요.',
  VERIFY_APPEAL_DUPLICATE: '이미 이의 제기했어요.',
  MEDIA_TYPE_NOT_ALLOWED: '지원하지 않는 파일 형식이에요.',
  MEDIA_TOO_LARGE: '파일이 너무 커요.',
  MEDIA_ALREADY_UPLOADED: '이미 파일을 올렸어요.',
  MEDIA_UPLOAD_URL_EXPIRED: '업로드 시간이 지났어요. 다시 시도해 주세요.',
  MEDIA_NOT_UPLOADED: '파일이 올라가지 않았어요. 다시 시도해 주세요.',

  // 05 §7.5 보상·펫·추천·챌린지·문의
  POINT_INSUFFICIENT: '포인트가 부족해요.',
  SHOP_ITEM_UNAVAILABLE: '지금은 살 수 없는 상품이에요.',
  SHOP_PRICE_CHANGED: '가격이 바뀌었어요. 새로고침해 주세요.',
  SHOP_ALREADY_OWNED: '이미 가지고 있는 상품이에요.',
  ACHIEVEMENT_NOT_EARNED: '아직 얻지 못한 업적이에요.',
  PET_NICKNAME_INVALID: '별명은 한글·영문 2~10자예요.',
  PET_NICKNAME_TAKEN: '이미 쓰고 있는 별명이에요.',
  PET_SPECIES_LOCKED: '아직 만날 수 없는 펫이에요.',
  PET_ALREADY_OWNED: '이미 함께하고 있는 펫이에요.',
  RECOMMENDATION_RATE_LIMITED: '추천은 10분에 한 번 받을 수 있어요.',
  RECOMMENDATION_EXPIRED: '추천 시간이 지났어요.',
  RECOMMENDATION_NOT_OPEN: '이미 처리한 추천이에요.',
  CHALLENGE_NOT_OPEN: '지금은 참여할 수 없는 챌린지예요.',
  CHALLENGE_FULL: '정원이 다 찼어요.',
  CHALLENGE_ALREADY_JOINED: '이미 참여한 챌린지예요.',
  CHALLENGE_NOT_JOINED: '참여 중인 챌린지가 아니에요.',
  SUPPORT_DUPLICATE_REPORT: '이미 신고한 대상이에요.',

  // 05 §7.6 중 앱이 볼 수 있는 것 (MISSION-06 계획 생성)
  AI_LLM_UNAVAILABLE: 'AI가 잠시 쉬고 있어요. 잠시 후 다시 시도해 주세요.',
  AI_TIMEOUT: 'AI 응답이 늦어요. 다시 시도해 주세요.',
  AI_INVALID_OUTPUT: '계획을 만들지 못했어요. 다시 시도해 주세요.',

  // 05 §7.7 앱 전용 (서버가 보내지 않는다. 문구는 parts/mobile-client §3.3)
  NETWORK_ERROR: '인터넷 연결을 확인해 주세요.',
  NETWORK_TIMEOUT: '응답이 늦어요. 다시 시도해 주세요.',
  AUTH_SESSION_EXPIRED: '다시 로그인해 주세요.',
  PERMISSION_DENIED: '권한이 필요해요.',
  CAPTURE_CANCELLED: '촬영을 취소했어요.',
  FILE_TOO_LARGE: '파일이 너무 커요.',
  VIDEO_TOO_LONG: '영상은 2분까지 찍을 수 있어요.',
  UPLOAD_FAILED: '업로드에 실패했어요.',
  GPS_UNAVAILABLE: '위치를 잡을 수 없어요.',
  DECISION_TIMEOUT: '결과가 늦어지고 있어요. 알림으로 알려드릴게요.',
};

/** 모르는 코드일 때 보여 줄 문구 (parts/mobile-client §3.3). */
export const FALLBACK_ERROR_MESSAGE = '잠시 후 다시 시도해 주세요.';

/**
 * 오류 코드의 문구를 돌려준다.
 * @param {string} code 05 §7의 오류 코드
 * @returns {string} 화면에 그대로 보여 줘도 되는 한국어 문장
 */
export function getErrorMessage(code) {
  return errorMessages[code] ?? FALLBACK_ERROR_MESSAGE;
}

export default errorMessages;
