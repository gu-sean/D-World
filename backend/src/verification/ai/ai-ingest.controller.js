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
import { AiIngestService } from './ai-ingest.service.js';
import { parseCallback } from './ai-callback-input.js';

export { parseCallback };

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
