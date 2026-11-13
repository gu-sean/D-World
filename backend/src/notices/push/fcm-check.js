/**
 * FCM 자격 증명 점검 (npm run push:check, scripts/push-check.mjs)
 *
 * 실제 발송 없이 "전송 검증 전용(dryRun)" 요청 하나로 확인한다.
 * - 기기 토큰을 주지 않으면 가짜 토큰으로 보낸다. 서비스 계정이 맞으면 FCM이 인증을 통과시킨 뒤
 *   토큰이 틀렸다는 오류를 돌려주므로, 그 오류가 오면 "키는 정상"으로 본다.
 * - 실제 기기 토큰을 주면 그 토큰까지 검증한다(dryRun이라 알림은 가지 않는다).
 * 오류 원문에는 인증 정보가 섞일 수 있어 코드와 짧게 자른 설명만 돌려준다.
 */

/** 인증은 통과했고 기기 토큰만 문제인 FCM 오류 코드 (push-sender.js의 쓸 수 없는 토큰 코드와 같음) */
const TOKEN_ONLY_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/** 서비스 계정을 FCM(구글 인증)이 받아 주지 않는 경우 */
const CREDENTIAL_CODES = new Set([
  'app/invalid-credential',
  'messaging/authentication-error',
  'messaging/third-party-auth-error',
  'messaging/mismatched-credential',
  'messaging/insufficient-permission',
]);

const NETWORK_PATTERN =
  /ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|network|getaddrinfo|socket hang up/i;

/** 가짜 토큰: 형식만 FCM 토큰처럼 생긴 값, 어떤 기기에도 연결되지 않음 */
export const PROBE_TOKEN = `push-check-${'x'.repeat(60)}`;

const shorten = (text) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .slice(0, 160);

/**
 * @param {{messaging: {send: Function}, token?: string}} options
 * @returns {Promise<{ok: boolean, kind: string, message: string, code?: string}>}
 *   kind: verified(실제 토큰까지 통과) · credentials_ok(키 정상, 가짜 토큰이라 토큰 오류) ·
 *         token_invalid(키는 정상인데 준 토큰이 틀림) · credentials_rejected · network · unknown
 */
export async function checkFcm({ messaging, token }) {
  try {
    await messaging.send(
      {
        token: token ?? PROBE_TOKEN,
        notification: {
          title: 'D-World 푸시 점검',
          body: 'dryRun 점검 메시지',
        },
      },
      true,
    );
    return {
      ok: true,
      kind: 'verified',
      message:
        '서비스 계정과 기기 토큰이 모두 정상이에요 (dryRun이라 알림은 보내지 않았어요).',
    };
  } catch (error) {
    const code = String(error?.code ?? '');
    if (TOKEN_ONLY_CODES.has(code)) {
      return token
        ? {
            ok: false,
            kind: 'token_invalid',
            code,
            message:
              '서비스 계정(키)은 정상이에요. 하지만 준 기기 토큰이 FCM에서 쓸 수 없다고 해요(만료·다른 프로젝트·앱 삭제).',
          }
        : {
            ok: true,
            kind: 'credentials_ok',
            code,
            message:
              '서비스 계정(키)이 정상이에요. (가짜 토큰으로 점검해서 토큰 오류가 나는 것이 정상이에요. 실제 기기까지 보려면 --token 을 주세요.)',
          };
    }
    if (CREDENTIAL_CODES.has(code)) {
      return {
        ok: false,
        kind: 'credentials_rejected',
        code,
        message: `구글이 서비스 계정을 받아 주지 않아요. 키가 폐기됐거나 다른 프로젝트의 것이거나 Firebase Cloud Messaging 권한이 없을 수 있어요. (${shorten(error?.message)})`,
      };
    }
    if (NETWORK_PATTERN.test(`${code} ${error?.message ?? ''}`)) {
      return {
        ok: false,
        kind: 'network',
        code,
        message: `FCM(구글)에 연결하지 못했어요. 네트워크·방화벽·프록시를 확인해 주세요. (${shorten(error?.message)})`,
      };
    }
    return {
      ok: false,
      kind: 'unknown',
      code,
      message: `예상하지 못한 오류예요: ${code || 'code 없음'} ${shorten(error?.message)}`,
    };
  }
}
