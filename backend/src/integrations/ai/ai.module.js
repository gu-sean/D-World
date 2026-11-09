import { Global, Module } from '@nestjs/common';
import { AiClient } from './ai.client.js';

/** 외부 AI 서버 호출기, 판정 요청(I01)과 이후 계획·추천·리포트 호출이 함께 사용 */
@Global()
@Module({
  providers: [AiClient],
  exports: [AiClient],
})
export class AiModule {}
