import { AiClient } from '../../integrations/ai/ai.client.js';
import { toVisionAnalysisRequest, UnsendableError } from './vision-contract.js';
import { toSensorEvaluationRequest } from './sensor-contract.js';

/**
 * DI 토큰: 백엔드가 AI 서버에 판정을 요청하는 구현
 *   enabled: boolean, 꺼져 있으면 디스패치 작업이 아무것도 하지 않음
 *   dispatch(request) → void | { result }
 *     - 영상(I01): 접수만(결과는 콜백), 센서(I02): 동기라 { result: AI 응답 }을 돌려줌
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
    if (request.verificationMethod === 'sensor') {
      return this.dispatchSensor(request);
    }
    const body = toVisionAnalysisRequest(request, this.client.callbackUrl, {
      mediaAccess: this.client.mediaAccess,
      photoEnabled: this.client.photoEnabled,
    });
    await this.client.post('/vision/analyses', body);
  }

  /** I02: POST {AI_SERVICE_URL}/internal/v1/sensor/evaluations, 응답이 곧 판정 결과 */
  async dispatchSensor(request) {
    if (!this.client.sensorEnabled) {
      throw new UnsendableError(
        '센서 인증은 AI가 판정하지 않음(AI_SENSOR_ENABLED=false), 관리자 검수',
      );
    }
    const body = toSensorEvaluationRequest(request, {
      mediaAccess: this.client.mediaAccess,
    });
    const { body: result } = await this.client.post(
      '/sensor/evaluations',
      body,
      { timeoutMs: this.client.sensorTimeoutMs },
    );
    return { result };
  }
}

export const aiDispatcherProvider = {
  provide: AI_DISPATCHER,
  useFactory: (client) =>
    client.enabled ? new HttpAiDispatcher(client) : new NoopAiDispatcher(),
  inject: [AiClient],
};
