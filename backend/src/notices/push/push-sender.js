import { readFileSync } from 'node:fs';
import { Logger } from '@nestjs/common';

/**
 * DI 토큰: 푸시 발송 구현
 *   send({ token, platform, title, body, linkScreen }) → void
 *   토큰이 더는 쓸 수 없으면(앱 삭제·만료) error.invalidToken = true로 던져 기기를 끈다
 */
export const PUSH_SENDER = Symbol('PUSH_SENDER');

/** 개발 전용: 발송 대신 로그에 출력, 운영에서는 환경 변수 검증이 막음 */
class ConsolePushSender {
  logger = new Logger('ConsolePushSender');

  async send({ token, platform, title, body }) {
    this.logger.warn(
      `[푸시 대체 출력] ${platform}:${token.slice(0, 8)}… ${title} / ${body}`,
    );
  }
}

// 쓸 수 없는 기기 토큰을 뜻하는 FCM 오류 코드
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/** PUSH_DRIVER=fcm: firebase-admin으로 발송, 토큰·본문은 로그에 남기지 않음 */
class FcmPushSender {
  constructor(messaging) {
    this.messaging = messaging;
  }

  async send({ token, title, body, linkScreen }) {
    try {
      await this.messaging.send({
        token,
        notification: { title, body },
        ...(linkScreen ? { data: { linkScreen: String(linkScreen) } } : {}),
      });
    } catch (error) {
      if (INVALID_TOKEN_CODES.has(error?.code)) error.invalidToken = true;
      throw error;
    }
  }
}

/**
 * 서비스 계정 JSON: 문자열(FCM_SERVICE_ACCOUNT_JSON)이 있으면 그것, 없으면 파일(FCM_SERVICE_ACCOUNT_PATH)
 * .env.example에서 복사한 빈 값("")은 없는 것으로 본다
 */
export function serviceAccountJson(config) {
  const inline = config.get('FCM_SERVICE_ACCOUNT_JSON');
  if (inline && inline.trim()) return inline;
  return readFileSync(config.get('FCM_SERVICE_ACCOUNT_PATH'), 'utf8');
}

/** firebase-admin은 fcm일 때만 불러와 초기화(다른 드라이버에서는 로드하지 않음) */
async function createFcmSender(config) {
  const [{ initializeApp, cert, getApps, getApp }, { getMessaging }] =
    await Promise.all([
      import('firebase-admin/app'),
      import('firebase-admin/messaging'),
    ]);
  const json = serviceAccountJson(config);
  const app = getApps().length
    ? getApp()
    : initializeApp({ credential: cert(JSON.parse(json)) });
  return new FcmPushSender(getMessaging(app));
}

export async function createPushSender(config) {
  const provider = config.get('PUSH_DRIVER');
  if (provider === 'console') return new ConsolePushSender();
  if (provider === 'fcm') return createFcmSender(config);
  throw new Error(`지원하지 않는 PUSH_DRIVER: ${provider}`);
}

export { FcmPushSender };
