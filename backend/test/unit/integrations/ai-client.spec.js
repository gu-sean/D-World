import { createServer } from 'node:http';
import {
  AiClient,
  AiRequestError,
  baseUrlOf,
  isPermanentFailure,
} from '../../../src/integrations/ai/ai.client.js';

function configOf(values) {
  return { get: (key) => values[key] };
}

describe('baseUrlOf', () => {
  it('끝 슬래시와 /internal/v1을 떼어 호스트만 남김', () => {
    expect(baseUrlOf('http://localhost:8001')).toBe('http://localhost:8001');
    expect(baseUrlOf('http://localhost:8001/')).toBe('http://localhost:8001');
    expect(baseUrlOf('http://ai:8001/internal/v1/')).toBe('http://ai:8001');
  });
});

describe('isPermanentFailure', () => {
  it('요청이 잘못된 4xx만 영구 실패', () => {
    expect(isPermanentFailure(400, 'AI_INVALID_REQUEST')).toBe(true);
    expect(isPermanentFailure(409, 'AI_INGEST_CONFLICT')).toBe(true);
    expect(isPermanentFailure(413, 'AI_MEDIA_TOO_LARGE')).toBe(true);
    expect(isPermanentFailure(401, 'COMMON_UNAUTHORIZED')).toBe(true);
  });

  it('연결 실패·5xx·429·용량 초과는 재시도 대상', () => {
    expect(isPermanentFailure(0, null)).toBe(false);
    expect(isPermanentFailure(500, null)).toBe(false);
    expect(isPermanentFailure(502, 'AI_LLM_UNAVAILABLE')).toBe(false);
    expect(isPermanentFailure(429, null)).toBe(false);
    expect(isPermanentFailure(503, 'AI_VISION_BUSY')).toBe(false);
  });
});

describe('AiClient', () => {
  let server;
  let received;
  let respond;
  let port;

  beforeAll(async () => {
    server = createServer((request, response) => {
      let raw = '';
      request.on('data', (chunk) => (raw += chunk));
      request.on('end', () => {
        received = {
          method: request.method,
          url: request.url,
          headers: request.headers,
          body: raw ? JSON.parse(raw) : null,
        };
        const { status, body, delayMs } = respond();
        setTimeout(() => {
          response.writeHead(status, { 'content-type': 'application/json' });
          response.end(body === undefined ? '' : JSON.stringify(body));
        }, delayMs ?? 0);
      });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  const client = (extra = {}) =>
    new AiClient(
      configOf({
        AI_SERVICE_URL: `http://127.0.0.1:${port}/internal/v1`,
        INTERNAL_API_TOKEN: 't'.repeat(32),
        PORT: 3000,
        ...extra,
      }),
    );

  it('설정이 둘 다 있어야 enabled', () => {
    expect(client().enabled).toBe(true);
    expect(client({ AI_SERVICE_URL: undefined }).enabled).toBe(false);
    expect(client({ INTERNAL_API_TOKEN: undefined }).enabled).toBe(false);
  });

  it('콜백 주소는 BACKEND_PUBLIC_URL 또는 localhost:PORT', () => {
    expect(client().callbackUrl).toBe(
      'http://localhost:3000/internal/v1/ai-callbacks',
    );
    expect(
      client({ BACKEND_PUBLIC_URL: 'https://api.example.com/' }).callbackUrl,
    ).toBe('https://api.example.com/internal/v1/ai-callbacks');
  });

  it('/internal/v1 아래로 JSON과 인증·요청 ID 헤더를 보냄', async () => {
    respond = () => ({ status: 202, body: { status: 'accepted' } });
    const result = await client().post(
      '/vision/analyses',
      { a: 1 },
      { requestId: 'req-123456789' },
    );
    expect(result).toEqual({ status: 202, body: { status: 'accepted' } });
    expect(received.method).toBe('POST');
    expect(received.url).toBe('/internal/v1/vision/analyses');
    expect(received.body).toEqual({ a: 1 });
    expect(received.headers['x-internal-token']).toBe('t'.repeat(32));
    expect(received.headers['x-request-id']).toBe('req-123456789');
  });

  it('오류 응답은 상태·코드·영구 여부를 담은 AiRequestError', async () => {
    respond = () => ({
      status: 409,
      body: { error: { code: 'AI_INGEST_CONFLICT', message: 'x' } },
    });
    const error = await client()
      .post('/vision/analyses', {})
      .catch((e) => e);
    expect(error).toBeInstanceOf(AiRequestError);
    expect(error).toMatchObject({
      status: 409,
      code: 'AI_INGEST_CONFLICT',
      permanent: true,
    });

    respond = () => ({
      status: 503,
      body: { error: { code: 'AI_VISION_BUSY', message: 'x' } },
    });
    const busy = await client()
      .post('/vision/analyses', {})
      .catch((e) => e);
    expect(busy).toMatchObject({ status: 503, permanent: false });
  });

  it('타임아웃·연결 실패는 일시 실패, 요청 본문을 오류에 싣지 않음', async () => {
    respond = () => ({ status: 202, body: {}, delayMs: 300 });
    const slow = await client()
      .post('/vision/analyses', { secret: 'do-not-leak' }, { timeoutMs: 50 })
      .catch((e) => e);
    expect(slow).toMatchObject({ status: 0, permanent: false });
    expect(slow.message).not.toContain('do-not-leak');

    const closed = await new AiClient(
      configOf({
        AI_SERVICE_URL: 'http://127.0.0.1:1',
        INTERNAL_API_TOKEN: 't'.repeat(32),
      }),
    )
      .post('/vision/analyses', {}, { timeoutMs: 500 })
      .catch((e) => e);
    expect(closed).toMatchObject({ status: 0, permanent: false });
  });
});
