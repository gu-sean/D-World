import { randomBytes, randomUUID } from 'node:crypto';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';

/**
 * 테스트용 닉네임: 접두어 + 소문자·숫자로 12자를 채움 (닉네임 규칙 ^[가-힣A-Za-z0-9]{2,12}$)
 * 공유 테스트 DB에 회원이 계속 쌓이므로 7자리 난수처럼 좁은 범위는 충돌한다(닉네임은 대소문자 무시 고유)
 */
export function testNickname(prefix = 'u') {
  const length = 12 - [...prefix].length;
  const random = BigInt(`0x${randomBytes(12).toString('hex')}`)
    .toString(36)
    .padStart(length, '0')
    .slice(-length);
  return `${prefix}${random}`;
}

/** 프로필이 있는 사용자와 access token을 만든다 → { id, token } */
export async function createUser(app, db) {
  const id = randomUUID();
  await db.query('INSERT INTO users (id) VALUES ($1)', [id]);
  await db.query('INSERT INTO profiles (user_id, nickname) VALUES ($1, $2)', [
    id,
    testNickname(),
  ]);
  const session = await db.withTransaction((t) =>
    app.get(SessionsService).create(t, 'user', id),
  );
  const token = await app
    .get(AccessTokenService)
    .issue('user', id, session.sessionId);
  return { id, token };
}
