import { BadRequestException } from '@nestjs/common';
import {
  jsonObject,
  number,
  oneOf,
  string,
  uuid,
  validateBody,
} from '../../common/validation.js';

const DECISIONS = ['approved', 'rejected', 'review_required'];

/**
 * AI 콜백 본문 검증 (AI 계약 VisionAnalysisCallback, ai/app/schemas/contracts.py)
 * - status=completed(기본): decision 필수
 * - status=failed: failureReason만 의미 있고 판정은 만들지 않음
 * - rawResult가 없으면 받은 본문 전체를 원본으로 저장
 */
export function parseCallback(body) {
  const input = validateBody(body, {
    ingestKey: string({ min: 8, max: 200, pattern: /^[\x21-\x7e]+$/ }),
    recordId: uuid(),
    status: oneOf(['completed', 'failed'], { optional: true }),
    decision: oneOf(DECISIONS, { optional: true }),
    engineVersion: string({ min: 1, max: 80, pattern: /\S/ }),
    confidence: number({ min: 0, max: 1, optional: true }),
    metrics: jsonObject({ optional: true }),
    reason: string({ min: 0, max: 2000, optional: true }),
    failureReason: string({ min: 0, max: 500, optional: true }),
    criteriaVersionId: uuid({ optional: true }),
    rawResult: jsonObject({ maxBytes: 262_144, optional: true }),
  });
  if (input.status !== 'failed' && !input.decision) {
    throw new BadRequestException(['decision: 값이 필요함']);
  }
  return { ...input, rawResult: input.rawResult ?? body };
}
