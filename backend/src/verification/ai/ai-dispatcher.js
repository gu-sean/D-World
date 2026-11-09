import { AiClient } from '../../integrations/ai/ai.client.js';
import { toVisionAnalysisRequest } from './vision-contract.js';

/**
 * DI 토큰: 백엔드가 AI 서버에 판정을 요청하는 구현
 *   enabled: boolean, 꺼져 있으면 디스패치 작업이 아무것도 하지 않음
 *   dispatch(request) → void
 *     - 실패하면 throw, error.permanent가 true면 재시도 없이 관리자 검수로 넘김
 *     - request는 AiDispatchService.buildRequest의 내부 요청
 * AI는 결과를 POST /internal/v1/ai-callbacks로 돌려보낸다(ingestKey로 멱등).
 */
export const AI_DISPATCHER = Symbol('AI_DISPATCHER');

class NoopAiDispatcher {
  enabled = false;
  async dispatch() {}
}

/** I01: POST {AI_SERVICE_URL}/internal/v1/vision/analyses, 접수는 202 */
export class HttpAiDispatcher {
  enabled = true;

  constructor(client) {
    this.client = client;
  }

  async dispatch(request) {
    const body = toVisionAnalysisRequest(request, this.client.callbackUrl, {
      mediaAccess: this.client.mediaAccess,
    });
    await this.client.post('/vision/analyses', body);
  }
}

export const aiDispatcherProvider = {
  provide: AI_DISPATCHER,
  useFactory: (client) =>
    client.enabled ? new HttpAiDispatcher(client) : new NoopAiDispatcher(),
  inject: [AiClient],
};
