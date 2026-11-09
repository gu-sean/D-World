import { BadRequestException } from '@nestjs/common';

/** 커서 목록의 ?limit= 검증 (없으면 기본값, 1~max 정수만 허용) */
export function parseLimit(query, defaultLimit, maxLimit) {
  if (query.limit === undefined) return defaultLimit;
  const limit = Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    throw new BadRequestException([`limit: 1~${maxLimit} 정수여야 함`]);
  }
  return limit;
}
