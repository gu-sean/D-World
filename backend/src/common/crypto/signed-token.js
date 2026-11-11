import { timingSafeEqual } from 'node:crypto';
import { hmacHex } from './crypto.js';

/**
 * 짧게 쓰는 서명 토큰 (휴대폰 인증 단계 ID, 소셜 가입 토큰)
 * 형식: base64url(JSON {k, d, exp}).hmac, 서버 비밀이 없으면 만들거나 확인할 수 없음
 * kind가 달라 서로 다른 용도의 토큰은 바꿔 쓸 수 없다
 */
export function signToken(secret, kind, data, ttlSec) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const body = Buffer.from(JSON.stringify({ k: kind, d: data, exp })).toString(
    'base64url',
  );
  return `${body}.${hmacHex(secret, `signed-token:${body}`)}`;
}

/** 올바른 토큰이면 data, 아니면 null(만료·변조·용도 불일치) */
export function readToken(secret, kind, token) {
  if (typeof token !== 'string') return null;
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra !== undefined) return null;
  const expected = Buffer.from(hmacHex(secret, `signed-token:${body}`), 'hex');
  const actual = Buffer.from(signature, 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (parsed.k !== kind || parsed.exp < Date.now() / 1000) return null;
    return parsed.d;
  } catch {
    return null;
  }
}
