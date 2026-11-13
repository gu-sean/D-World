import { HttpException, HttpStatus } from '@nestjs/common';
import pg from 'pg';
import { ERROR_CODES, resolveCode } from './error-codes.js';

/**
 * 오류 본문 { error: { code, message, details } } (팀 문서 05 §2.2)
 * code: 클라이언트 분기용 고정 코드(05 §7 표), message: 화면에 그대로 보여줄 수 있는 한국어 문장
 * toErrorBody는 { statusCode, error }를 돌려주고 필터가 error만 응답함
 */

// 제약 위반은 SQLSTATE별 의미만 전달, DB 원문 메시지는 응답에서 제외
const PG_MAPPING = {
  23505: { status: 409, code: 'conflict', message: null },
  23503: { status: 409, code: 'conflict', message: '참조 관계 불일치' },
  23502: { status: 422, code: 'bad_request', message: '필수 값 누락' },
  23514: {
    status: 422,
    code: 'bad_request',
    message: '허용되지 않는 요청',
  },
  40001: { status: 503, code: 'conflict', message: '잠시 후 재시도 필요' },
  '40P01': { status: 503, code: 'conflict', message: '잠시 후 재시도 필요' },
};

/** 입력 검사 메시지 배열("필드: 사유")을 { 필드: 사유 }로 변환 */
function toFields(messages) {
  const fields = {};
  for (const item of messages) {
    const index = item.indexOf(': ');
    if (index > 0) fields[item.slice(0, index)] = item.slice(index + 2);
    else fields[item] = '값이 올바르지 않아요.';
  }
  return fields;
}

function build(status, legacyCode, message, details) {
  const resolved = resolveCode(legacyCode, status);
  const fallback = ERROR_CODES[resolved.code]?.[1];
  return {
    statusCode: resolved.status,
    error: {
      code: resolved.code,
      message: resolved.message ?? message ?? fallback ?? '',
      details: details ?? null,
    },
  };
}

/** Express body-parser가 던지는 요청 본문 오류(너무 큼 413, JSON 형식 오류 400 등) */
export function isBodyParserError(exception) {
  return (
    typeof exception?.type === 'string' &&
    Number.isInteger(exception.status) &&
    exception.status >= 400 &&
    exception.status < 500
  );
}

/**
 * 고정 문구(05 §7 표)로 바뀌어 응답에서 사라진 서비스 원문을 돌려준다 (서버 로그 전용, 응답 계약 불변)
 * - 대상: 코드가 있는 예외(AppException)만
 * - 제외: 프레임워크 404·429 등(코드 없음), 입력 검사 배열(이미 details.fields로 전달)
 *
 * @param {unknown} exception
 * @param {{error: {message: string}}} body toErrorBody의 결과
 * @returns {string|null}
 */
export function replacedMessage(exception, body) {
  if (!(exception instanceof HttpException)) return null;
  const response = exception.getResponse();
  if (typeof response !== 'object' || typeof response.code !== 'string') {
    return null;
  }
  const raw = response.message;
  if (typeof raw !== 'string' || raw === '' || raw === body.error.message) {
    return null;
  }
  return raw;
}

export function toErrorBody(exception) {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const response = exception.getResponse();
    const object = typeof response === 'object' ? response : {};
    const raw =
      typeof response === 'string'
        ? response
        : (object.message ?? exception.message);
    let details = object.details ?? null;
    if (object.retryAfter !== undefined) {
      details = { ...details, retryAfterSeconds: object.retryAfter };
    }
    if (Array.isArray(raw)) {
      // 입력 검사 실패, 관리자 변경 요청의 reason 누락은 전용 코드(05 §5.2)
      const fields = toFields(raw);
      // reason의 누락·빈 값·길이 오류는 전용 코드로 안내
      const code =
        fields.reason !== undefined ? 'admin_reason_required' : 'bad_request';
      return build(status, code, null, { fields });
    }
    // 코드가 없는 프레임워크 예외(404 경로 없음, 429 등)는 상태별 공통 코드, 문구는 표 기준
    const hasCode = typeof object.code === 'string';
    return build(status, object.code, hasCode ? raw : null, details);
  }

  if (isBodyParserError(exception)) {
    const tooLarge = exception.status === HttpStatus.PAYLOAD_TOO_LARGE;
    return build(
      exception.status,
      'bad_request',
      tooLarge ? '요청 본문이 너무 큼' : '요청 본문을 읽을 수 없음',
      null,
    );
  }

  if (exception instanceof pg.DatabaseError && exception.code) {
    const mapped = PG_MAPPING[exception.code];
    if (mapped) return build(mapped.status, mapped.code, mapped.message, null);
  }

  return build(HttpStatus.INTERNAL_SERVER_ERROR, 'internal_error', null, null);
}
