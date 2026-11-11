/**
 * 화면이 서버에 보내기 전에 하는 입력 검사 (11 §8.1·§8.2·§8.4).
 *
 * 모든 함수는 같은 모양을 돌려준다: `{ok: true}` 또는 `{ok: false, message: '…'}`.
 * `message`는 입력칸 아래에 그대로 보여 줘도 되는 한국어 문장이다.
 *
 * **서버가 정답이다.** 여기 검사는 빠른 안내일 뿐이고, 최종 판단은 서버 응답
 * (`COMMON_VALIDATION_FAILED`·`AUTH_*`)이 한다.
 */

const ok = { ok: true };
const fail = (message) => ({ ok: false, message });

/** 11 §8.1 휴대폰 번호: 숫자 11자리 `^010\d{8}$` */
export const PHONE_RE = /^010\d{8}$/;
/** 11 §8.1 닉네임: 한글·영문·숫자 2~12자 */
export const NICKNAME_RE = /^[가-힣A-Za-z0-9]{2,12}$/;
/** 11 §8.1 펫 별명: 한글·영문 2~10자 */
export const PET_NICKNAME_RE = /^[가-힣A-Za-z]{2,10}$/;
/** 11 §8.1 인증번호: 숫자 6자리 */
export const OTP_RE = /^\d{6}$/;

/** 11 §8.2 운동별 목표 허용 범위. `running`은 단위에 따라 범위가 다르다. */
export const EXERCISE_TARGET_RANGE = {
  push_up: { reps: { min: 1, max: 100 } },
  burpee: { reps: { min: 1, max: 50 } },
  squat: { reps: { min: 1, max: 200 } },
  lunge: { reps: { min: 2, max: 100 } },
  plank: { seconds: { min: 10, max: 90 } },
  running: { meters: { min: 500, max: 21000 }, seconds: { min: 300, max: 7200 } },
};

/** 11 §8.4 길이 제한. `[최소, 최대]` */
export const LENGTH_LIMITS = {
  goalTitle: [1, 200],
  goalDescription: [0, 1000],
  missionTitle: [1, 200],
  missionNote: [0, 500],
  appealReason: [10, 500],
  supportTitle: [1, 120],
  supportBody: [1, 2000],
  challengeTitle: [1, 30],
  challengeDescription: [1, 500],
  planRejectReason: [0, 300],
  withdrawalReason: [0, 500],
};

/**
 * 휴대폰 번호 (11 §8.1). 입력은 숫자만 받는다.
 * @param {string} value
 * @returns {{ok: boolean, message?: string}}
 */
export function validatePhone(value) {
  const text = String(value ?? '').trim();
  if (text === '') return fail('휴대폰 번호를 입력해 주세요.');
  if (!PHONE_RE.test(text)) return fail('010으로 시작하는 숫자 11자리로 입력해 주세요.');
  return ok;
}

/**
 * 비밀번호 (11 §8.1). 10~64자, 다른 조건 없음. 공백도 글자로 센다.
 * @param {string} value
 */
export function validatePassword(value) {
  const text = String(value ?? '');
  if (text.length === 0) return fail('비밀번호를 입력해 주세요.');
  if (text.length < 10 || text.length > 64) return fail('비밀번호는 10~64자로 입력해 주세요.');
  return ok;
}

/**
 * 비밀번호 확인란.
 * @param {string} value
 * @param {string} confirm
 */
export function validatePasswordConfirm(value, confirm) {
  if (String(confirm ?? '') === '') return fail('비밀번호를 한 번 더 입력해 주세요.');
  if (String(value ?? '') !== String(confirm)) return fail('비밀번호가 서로 달라요.');
  return ok;
}

/**
 * 닉네임 (11 §8.1). 중복 확인은 A03이 한다.
 * @param {string} value
 */
export function validateNickname(value) {
  const text = String(value ?? '').trim();
  if (text === '') return fail('닉네임을 입력해 주세요.');
  if (!NICKNAME_RE.test(text)) return fail('닉네임은 한글·영문·숫자 2~12자예요.');
  return ok;
}

/**
 * 펫 별명 (11 §8.1). 내 펫 안에서 유일한지는 서버(A84)가 본다.
 * @param {string} value
 */
export function validatePetNickname(value) {
  const text = String(value ?? '').trim();
  if (text === '') return fail('별명을 입력해 주세요.');
  if (!PET_NICKNAME_RE.test(text)) return fail('별명은 한글·영문 2~10자예요.');
  return ok;
}

/**
 * 인증번호 (11 §8.1).
 * @param {string} value
 */
export function validateOtp(value) {
  const text = String(value ?? '').trim();
  if (text === '') return fail('인증번호를 입력해 주세요.');
  if (!OTP_RE.test(text)) return fail('인증번호는 숫자 6자리예요.');
  return ok;
}

/**
 * 운동 미션 목표 값 (11 §8.2).
 * 운동이 아닌 미션(`exerciseCode`가 없음)은 1 이상이기만 하면 된다.
 * @param {number|string} value
 * @param {{exerciseCode?: string|null, targetUnit?: string}} [context]
 */
export function validateTarget(value, context = {}) {
  const { exerciseCode = null, targetUnit } = context;
  const number = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isFinite(number)) return fail('숫자로 입력해 주세요.');
  if (!Number.isInteger(number)) return fail('정수로 입력해 주세요.');

  if (!exerciseCode) {
    if (number < 1) return fail('1 이상으로 입력해 주세요.');
    return ok;
  }

  const byUnit = EXERCISE_TARGET_RANGE[exerciseCode];
  if (!byUnit) return fail('지원하지 않는 운동이에요.');

  const unit = targetUnit ?? Object.keys(byUnit)[0];
  const range = byUnit[unit];
  if (!range) return fail('이 운동에 맞지 않는 단위예요.');

  if (number < range.min || number > range.max) {
    return fail(`${range.min}~${range.max} 사이로 입력해 주세요.`);
  }
  return ok;
}

/**
 * 11 §8.4의 길이 제한을 본다.
 * @param {string} value
 * @param {keyof typeof LENGTH_LIMITS} kind
 */
export function validateLength(value, kind) {
  const limit = LENGTH_LIMITS[kind];
  if (!limit) return ok;
  const [min, max] = limit;
  const text = String(value ?? '').trim();
  if (text.length < min) {
    return fail(min === 1 ? '내용을 입력해 주세요.' : `${min}자 이상 입력해 주세요.`);
  }
  if (text.length > max) return fail(`${max}자까지 입력할 수 있어요.`);
  return ok;
}

/**
 * 목표·미션 기간 (11 §8.3 규칙 2·3의 앱 쪽 미리 검사).
 * @param {string} startDate `YYYY-MM-DD`
 * @param {string} endDate `YYYY-MM-DD`
 */
export function validatePeriod(startDate, endDate) {
  if (!startDate || !endDate) return fail('기간을 골라 주세요.');
  if (String(endDate) < String(startDate)) return fail('종료일은 시작일보다 뒤여야 해요.');
  return ok;
}

/** `validators` 객체로 한 번에 내보낸다 (parts/mobile-client §4.2). */
export const validators = {
  validatePhone,
  validatePassword,
  validatePasswordConfirm,
  validateNickname,
  validatePetNickname,
  validateOtp,
  validateTarget,
  validateLength,
  validatePeriod,
  PHONE_RE,
  NICKNAME_RE,
  PET_NICKNAME_RE,
  OTP_RE,
  EXERCISE_TARGET_RANGE,
  LENGTH_LIMITS,
};

export default validators;
