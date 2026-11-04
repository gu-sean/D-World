import { ConfigService } from '@nestjs/config';

/**
 * DI 토큰: 백엔드가 AI 서비스에 판정을 요청하는 구현 (규격 확정 전이라 임시 형태, 문서 05의 확인 필요 4)
 *   enabled: boolean, 꺼져 있으면 디스패치 작업이 아무것도 하지 않음
 *   dispatch(request) → void, 실패하면 throw(작업이 백오프로 재시도)
 * AI는 결과를 POST /internal/ai/verification-results로 돌려보낸다(ingestKey로 멱등).
 */
export const AI_DISPATCHER = Symbol('AI_DISPATCHER');

export class NoopAiDispatcher {
  enabled = false;
  async dispatch() {}
}

/** AI_SERVICE_URL로 JSON을 POST, 인증은 X-Internal-Token 헤더 */
export class HttpAiDispatcher {
  enabled = true;

  constructor(url, secret, timeoutMs = 10_000) {
    this.url = `${url.replace(/\/+$/, '')}/verification-requests`;
    this.secret = secret;
    this.timeoutMs = timeoutMs;
  }

  async dispatch(request) {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-token': this.secret,
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`AI 서비스 응답 ${response.status}`);
    }
  }
}

export const aiDispatcherProvider = {
  provide: AI_DISPATCHER,
  useFactory(config) {
    const url = config.get('AI_SERVICE_URL');
    const secret = config.get('AI_SERVICE_SECRET');
    return url && secret
      ? new HttpAiDispatcher(url, secret)
      : new NoopAiDispatcher();
  },
  inject: [ConfigService],
};
