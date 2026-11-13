import { randomUUID } from 'node:crypto';
import { Dependencies, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const DEFAULT_AI_TIMEOUT_MS = 10_000;

/** 운영 + AI 사용 + 저장소 키 방식이면 true (경고 대상) */
export function warnsObjectKeyInProduction(config) {
  return (
    config.get('NODE_ENV') === 'production' &&
    Boolean(config.get('AI_SERVICE_URL') && config.get('INTERNAL_API_TOKEN')) &&
    (config.get('AI_MEDIA_ACCESS') ?? 'object_key') === 'object_key'
  );
}

/** AI 호출 실패. permanent=true면 다시 보내도 같은 결과(요청이 잘못됨), false면 나중에 재시도 */
export class AiRequestError extends Error {
  constructor(
    message,
    { status = 0, code = null, permanent = false, timedOut = false } = {},
  ) {
    super(message);
    this.name = 'AiRequestError';
    this.status = status;
    this.code = code;
    this.permanent = permanent;
    this.timedOut = timedOut;
  }
}

/**
 * 상태·코드로 영구 실패인지 판단
 * - 영구: 4xx 중 요청 자체가 잘못된 경우(AI_INVALID_*, AI_UNSUPPORTED_MEDIA, AI_INGEST_CONFLICT 등)
 * - 일시: 연결 실패·타임아웃(status 0), 5xx, 429, 용량 초과(AI_VISION_BUSY)
 */
export function isPermanentFailure(status, code) {
  if (status === 0 || status >= 500 || status === 429) return false;
  if (code === 'AI_VISION_BUSY') return false;
  return status >= 400;
}

/** AI_SERVICE_URL 끝의 슬래시와 `/internal/v1`을 떼어 호스트 주소만 남김 */
export function baseUrlOf(url) {
  return String(url)
    .replace(/\/+$/, '')
    .replace(/\/internal\/v1$/, '');
}

/**
 * AI 서버 호출기 (팀 문서 parts/backend §4.9)
 * - 모든 경로는 `/internal/v1` 아래, 헤더 X-Internal-Token·X-Request-Id
 * - 타임아웃은 호출마다 지정(판정 접수 10초, 계획 생성 60초)
 * - 실패는 AiRequestError로 통일, 응답 본문의 error.code를 담음
 */
@Injectable()
@Dependencies(ConfigService)
export class AiClient {
  logger = new Logger('AiClient');

  constructor(config) {
    this.config = config;
  }

  /** 운영에서 AI를 켜 둔 채 파일을 저장소 키로 알리면 AI에 R2 읽기 키가 있어야 하므로 경고 */
  onModuleInit() {
    if (warnsObjectKeyInProduction(this.config)) {
      this.logger.warn(
        '운영에서 AI_MEDIA_ACCESS=object_key: AI 서버가 R2 키를 직접 가져야 함. AI가 downloadUrl을 받을 수 있게 되면 signed_url로 전환하세요',
      );
    }
  }

  get enabled() {
    return Boolean(
      this.config.get('AI_SERVICE_URL') &&
      this.config.get('INTERNAL_API_TOKEN'),
    );
  }

  /** 기본 호출 타임아웃(판정·리포트·재조정 접수) */
  get requestTimeoutMs() {
    return this.config.get('AI_REQUEST_TIMEOUT_MS') ?? 10_000;
  }

  /** 사진 증거도 AI에 보낼지(기본 false: 사진은 관리자 검수) */
  get photoEnabled() {
    return this.config.get('AI_PHOTO_ENABLED') === true;
  }

  /** 판정 요청에 파일을 알려 주는 방식 */
  get mediaAccess() {
    return this.config.get('AI_MEDIA_ACCESS') ?? 'object_key';
  }

  /** 계획 생성(I03) 타임아웃 */
  get planTimeoutMs() {
    return this.config.get('AI_PLAN_TIMEOUT_MS') ?? 60_000;
  }

  /** 상황 추천(I04) 타임아웃 */
  get recommendTimeoutMs() {
    return this.config.get('AI_RECOMMEND_TIMEOUT_MS') ?? 15_000;
  }

  get callbackBaseUrl() {
    return String(
      this.config.get('BACKEND_PUBLIC_URL') ??
        `http://localhost:${this.config.get('PORT')}`,
    ).replace(/\/+$/, '');
  }

  /** AI가 판정 결과를 돌려줄 백엔드 주소 (AI의 BACKEND_CALLBACK_URL과 같아야 함) */
  get callbackUrl() {
    return `${this.callbackBaseUrl}/internal/v1/ai-callbacks`;
  }

  /** @returns {Promise<{status: number, body: any}>} */
  async post(path, body, { timeoutMs, requestId } = {}) {
    const base = baseUrlOf(this.config.get('AI_SERVICE_URL'));
    let response;
    try {
      response = await fetch(`${base}/internal/v1${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-token': this.config.get('INTERNAL_API_TOKEN'),
          'x-request-id': requestId ?? randomUUID(),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(
          timeoutMs ??
            this.config.get('AI_REQUEST_TIMEOUT_MS') ??
            DEFAULT_AI_TIMEOUT_MS,
        ),
      });
    } catch (error) {
      // 연결 실패·타임아웃: 본문(요청 내용)은 오류에 싣지 않는다
      throw new AiRequestError(`AI 서버에 연결하지 못함: ${error.name}`, {
        status: 0,
        permanent: false,
        timedOut: error.name === 'TimeoutError' || error.name === 'AbortError',
      });
    }

    const text = await response.text().catch(() => '');
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    if (!response.ok) {
      // AI는 오류를 { error: { code } } 또는 FastAPI 기본 { detail: { code } } / { detail: '문장' }로 줌
      const code = parsed?.error?.code ?? parsed?.detail?.code ?? null;
      throw new AiRequestError(
        `AI 서버 응답 ${response.status} ${code ?? ''}`.trim(),
        {
          status: response.status,
          code,
          permanent: isPermanentFailure(response.status, code),
        },
      );
    }
    return { status: response.status, body: parsed };
  }
}
