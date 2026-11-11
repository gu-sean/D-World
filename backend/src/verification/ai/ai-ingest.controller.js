import {
  BadRequestException,
  Bind,
  Body,
  Controller,
  Dependencies,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/auth/public.decorator.js';
import {
  jsonObject,
  number,
  oneOf,
  string,
  uuid,
  validateBody,
} from '../../common/validation.js';
import { AiIngestService } from './ai-ingest.service.js';

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

/** 사용자·관리자 토큰 대신 공유 비밀 헤더(X-Internal-Token)로 인증하는 내부 경로 */
@Controller('internal/v1/ai-callbacks')
@Public()
@SkipThrottle()
@Dependencies(AiIngestService)
export class AiIngestController {
  constructor(ingest) {
    this.ingest = ingest;
  }

  /** AI가 설정으로 받는 콜백 주소(BACKEND_CALLBACK_URL) 그대로 */
  @Post()
  @HttpCode(200)
  @Bind(Req(), Body())
  receive(request, body) {
    this.ingest.assertSecret(request);
    return this.ingest.ingest(parseCallback(body));
  }

  /** 기존 경로, 같은 처리 */
  @Post('verification-results')
  @HttpCode(200)
  @Bind(Req(), Body())
  receiveLegacy(request, body) {
    this.ingest.assertSecret(request);
    return this.ingest.ingest(parseCallback(body));
  }
}
