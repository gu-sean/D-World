import {
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

/** 사용자·관리자 토큰 대신 공유 비밀 헤더(X-Internal-Token)로 인증하는 내부 경로 */
@Controller('internal/v1/ai-callbacks')
@Public()
@SkipThrottle()
@Dependencies(AiIngestService)
export class AiIngestController {
  constructor(ingest) {
    this.ingest = ingest;
  }

  @Post('verification-results')
  @HttpCode(200)
  @Bind(Req(), Body())
  receive(req, body) {
    this.ingest.assertSecret(req);
    return this.ingest.ingest(
      validateBody(body, {
        ingestKey: string({ min: 8, max: 200, pattern: /^[\x21-\x7e]+$/ }),
        recordId: uuid(),
        decision: oneOf(['approved', 'rejected', 'review_required']),
        engineVersion: string({ min: 1, max: 80, pattern: /\S/ }),
        confidence: number({ min: 0, max: 1, optional: true }),
        metrics: jsonObject({ optional: true }),
        reason: string({ min: 0, max: 2000, optional: true }),
        criteriaVersionId: uuid({ optional: true }),
        rawResult: jsonObject({ maxBytes: 262_144 }),
      }),
    );
  }
}
