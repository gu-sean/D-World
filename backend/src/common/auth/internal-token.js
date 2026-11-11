import { createHash, timingSafeEqual } from 'node:crypto';
import { HttpStatus } from '@nestjs/common';
import { AppException } from '../errors/app-exception.js';

const digest = (value) => createHash('sha256').update(String(value)).digest();

/**
 * AI 서버가 부르는 내부 경로의 공유 비밀 확인 (헤더 X-Internal-Token)
 * 설정이 없으면 경로를 닫고(503), 불일치는 상수 시간으로 비교해 401
 */
export function assertInternalToken(config, request) {
  const expected = config.get('INTERNAL_API_TOKEN');
  if (!expected) {
    throw new AppException(
      HttpStatus.SERVICE_UNAVAILABLE,
      'ai_ingest_disabled',
      'AI 결과 수신이 설정되지 않음',
    );
  }
  const given = request.headers?.['x-internal-token'];
  if (
    typeof given !== 'string' ||
    !timingSafeEqual(digest(given), digest(expected))
  ) {
    throw new AppException(
      HttpStatus.UNAUTHORIZED,
      'unauthorized',
      '인증 필요',
    );
  }
}
