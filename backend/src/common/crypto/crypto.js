import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';

/** refresh token 등 추측 불가 토큰, 32바이트 base64url */
export const randomToken = (bytes = 32) =>
  randomBytes(bytes).toString('base64url');

/** 고엔트로피 토큰의 저장용 해시 */
export const sha256Hex = (value) =>
  createHash('sha256').update(value).digest('hex');

/** 6자리 숫자 코드, 6자리라 느린 해시 대신 서버 키가 있는 HMAC으로 저장 */
export const randomCode = () =>
  String(randomInt(0, 1_000_000)).padStart(6, '0');

export const hmacHex = (secret, value) =>
  createHmac('sha256', secret).update(value).digest('hex');
