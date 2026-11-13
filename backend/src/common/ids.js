import { randomInt } from 'node:crypto';

// 식별자: 8자 영숫자(대소문자 구분, 62^8 ≈ 218조). DB의 short_id 도메인과 같은 규칙
const ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 8;

export const ID_PATTERN = /^[0-9A-Za-z]{8}$/;

/** 새 식별자 (암호학적 난수). 충돌은 withTransaction이 PK 중복을 감지해 재시도 */
export function newId() {
  let id = '';
  for (let i = 0; i < ID_LENGTH; i++)
    id += ALPHABET[randomInt(ALPHABET.length)];
  return id;
}

export const isId = (value) =>
  typeof value === 'string' && ID_PATTERN.test(value);
