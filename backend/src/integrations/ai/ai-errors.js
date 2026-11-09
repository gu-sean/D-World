import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app-exception.js';

/**
 * LLM 호출(I03·I04) 실패 → 앱에 보여 줄 오류 (팀 문서 parts/backend §4.9)
 * - AI가 준 AI_LLM_UNAVAILABLE·AI_INVALID_OUTPUT은 그대로
 * - 코드 없이 502면 AI_INVALID_OUTPUT (AI는 LLM 결과가 규칙에 맞지 않을 때 문장만 담아 502를 줌)
 * - 백엔드 타임아웃은 AI_TIMEOUT
 * - 연결 실패·그 밖의 오류는 AI_LLM_UNAVAILABLE
 */
export function llmErrorCode(error) {
  if (error?.timedOut) return 'AI_TIMEOUT';
  if (error?.code === 'AI_LLM_UNAVAILABLE') return 'AI_LLM_UNAVAILABLE';
  if (error?.code === 'AI_INVALID_OUTPUT') return 'AI_INVALID_OUTPUT';
  if (error?.status === 502 && !error.code) return 'AI_INVALID_OUTPUT';
  return 'AI_LLM_UNAVAILABLE';
}

const STATUS = {
  AI_TIMEOUT: HttpStatus.GATEWAY_TIMEOUT,
  AI_INVALID_OUTPUT: HttpStatus.BAD_GATEWAY,
  AI_LLM_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
};

export function toLlmException(error) {
  const code = llmErrorCode(error);
  return new AppException(STATUS[code], code, 'AI 호출 실패');
}
