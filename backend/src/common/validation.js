import { BadRequestException } from '@nestjs/common';
import { ID_PATTERN } from './ids.js';

/**
 * 요청 본문 검증, 스펙에 없는 필드는 버림
 * JS에는 DTO 타입 메타데이터가 없어 class-validator 대신 규칙 함수를 씀
 * 규칙은 (raw) => ({ value } | { error })
 */
const ok = (value) => ({ value });
const fail = (error) => ({ error });

function withOptional(optional, rule) {
  return (raw) => {
    if (raw === undefined || raw === null) {
      return optional ? ok(undefined) : fail('값이 필요함');
    }
    return rule(raw);
  };
}

export function string({
  min = 1,
  max = 1000,
  pattern,
  optional = false,
  patternMessage = '형식이 올바르지 않음',
} = {}) {
  return withOptional(optional, (raw) => {
    if (typeof raw !== 'string') return fail('문자열이어야 함');
    if (raw.length < min || raw.length > max) {
      return fail(`${min}~${max}자여야 함`);
    }
    if (pattern && !pattern.test(raw)) return fail(patternMessage);
    return ok(raw);
  });
}

export function boolean({ optional = false } = {}) {
  return withOptional(optional, (raw) =>
    typeof raw === 'boolean' ? ok(raw) : fail('true 또는 false여야 함'),
  );
}

/** 식별자(8자 영숫자). 대소문자를 구분하므로 값은 그대로 유지 */
export function shortId({ optional = false } = {}) {
  return string({ min: 8, max: 8, pattern: ID_PATTERN, optional });
}

export function integer({
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
  optional = false,
} = {}) {
  return withOptional(optional, (raw) => {
    if (!Number.isSafeInteger(raw)) return fail('정수여야 함');
    if (raw < min || raw > max) return fail(`${min}~${max} 사이여야 함`);
    return ok(raw);
  });
}

export function number({
  min = -Infinity,
  max = Infinity,
  optional = false,
} = {}) {
  return withOptional(optional, (raw) => {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      return fail('숫자여야 함');
    }
    if (raw < min || raw > max) return fail(`${min}~${max} 사이여야 함`);
    return ok(raw);
  });
}

const TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** 시간대가 있는 ISO 8601 시각, 값은 UTC ISO 문자열로 정규화 */
export function timestamp({ optional = false } = {}) {
  return withOptional(optional, (raw) => {
    if (typeof raw !== 'string' || !TIMESTAMP_PATTERN.test(raw)) {
      return fail('시간대가 있는 ISO 8601 형식이어야 함');
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime())
      ? fail('올바른 시각이 아님')
      : ok(parsed.toISOString());
  });
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** KST 비즈니스 날짜 YYYY-MM-DD, 2026-02-31처럼 존재하지 않는 날짜는 거절 */
export function dateString({ optional = false } = {}) {
  return withOptional(optional, (raw) => {
    if (typeof raw !== 'string' || !DATE_PATTERN.test(raw)) {
      return fail('YYYY-MM-DD 형식이어야 함');
    }
    const parsed = new Date(`${raw}T00:00:00Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== raw
    ) {
      return fail('존재하지 않는 날짜');
    }
    return ok(raw);
  });
}

/** 자유 형식 JSON 객체(예: 센서 요약), 구조는 검사하지 않고 직렬화 크기만 제한 */
export function jsonObject({ maxBytes = 16_384, optional = false } = {}) {
  return withOptional(optional, (raw) => {
    if (typeof raw !== 'object' || Array.isArray(raw))
      return fail('객체여야 함');
    if (Buffer.byteLength(JSON.stringify(raw)) > maxBytes) {
      return fail(`${maxBytes}바이트 이하여야 함`);
    }
    return ok(raw);
  });
}

export function oneOf(values, { optional = false } = {}) {
  return withOptional(optional, (raw) =>
    values.includes(raw)
      ? ok(raw)
      : fail(`${values.join(', ')} 중 하나여야 함`),
  );
}

export function array(itemRule, { min = 0, max = 20, optional = false } = {}) {
  return withOptional(optional, (raw) => {
    if (!Array.isArray(raw)) return fail('배열이어야 함');
    if (raw.length < min) return fail(`${min}개 이상이어야 함`);
    if (raw.length > max) return fail(`${max}개 이하여야 함`);
    const items = [];
    for (const [index, item] of raw.entries()) {
      const result = itemRule(item);
      if (result.error) return fail(`[${index}] ${result.error}`);
      items.push(result.value);
    }
    return ok(items);
  });
}

export function object(spec, { optional = false } = {}) {
  return withOptional(optional, (raw) => {
    if (typeof raw !== 'object' || Array.isArray(raw)) {
      return fail('객체여야 함');
    }
    const errors = [];
    const value = {};
    for (const [key, rule] of Object.entries(spec)) {
      const result = rule(raw[key]);
      if (result.error) errors.push(`${key}: ${result.error}`);
      else if (result.value !== undefined) value[key] = result.value;
    }
    return errors.length ? fail(errors.join(', ')) : ok(value);
  });
}

export function validateBody(body, spec) {
  const result = object(spec)(body ?? {});
  if (result.error) {
    throw new BadRequestException(result.error.split(', '));
  }
  return result.value;
}

/** 휴대폰 번호 입력: 010-1234-5678, 01012345678, +821012345678 → E.164 */
export function normalizeKoreanPhone(input) {
  const digits = String(input).replace(/[\s-]/g, '');
  let national;
  if (/^\+82[0-9]{9,10}$/.test(digits)) national = digits.slice(3);
  else if (/^0[0-9]{9,10}$/.test(digits)) national = digits.slice(1);
  else return null;
  // 휴대폰 대역(10·11·16·17·18·19)만 허용
  if (!/^1[016789][0-9]{7,8}$/.test(national)) return null;
  return `+82${national}`;
}

export function phone({ optional = false } = {}) {
  return withOptional(optional, (raw) => {
    if (typeof raw !== 'string') return fail('문자열이어야 함');
    const normalized = normalizeKoreanPhone(raw);
    return normalized ? ok(normalized) : fail('올바른 국내 휴대폰 번호가 아님');
  });
}

export const password = () =>
  string({ min: 10, max: 64, patternMessage: '비밀번호 형식이 올바르지 않음' });

export const nickname = (options) =>
  string({
    min: 2,
    max: 12,
    pattern: /^[가-힣A-Za-z0-9]+$/,
    patternMessage: '한글·영문·숫자만 사용 가능',
    ...options,
  });

/** 경로 파라미터의 식별자 검증(형식이 틀리면 400) */
export const idOf = (id) => validateBody({ id }, { id: shortId() }).id;
