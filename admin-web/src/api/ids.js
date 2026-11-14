// 식별자: 8자 영숫자(대소문자 구분). 백엔드·DB의 short_id와 같은 규칙
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export const ID_PATTERN = /^[0-9A-Za-z]{8}$/;

/** 새 식별자 (브라우저 암호학적 난수, 편향 없이 62개 중 선택) */
export function newId() {
  const limit = 256 - (256 % ALPHABET.length);
  let id = '';
  while (id.length < 8) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    for (const byte of bytes) {
      if (byte < limit && id.length < 8) id += ALPHABET[byte % ALPHABET.length];
    }
  }
  return id;
}
