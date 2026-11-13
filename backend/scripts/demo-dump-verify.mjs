// 시연 덤프가 SHA256.txt와 같은지 확인한다 (demo.mjs가 복원 직전에 사용)
// 윈도우 git의 줄바꿈 변환(CRLF)만 다른 경우는 LF로 되돌려 같은 파일로 본다.
import { createHash } from 'node:crypto';

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

/** CRLF → LF (바이트 단위, 인코딩에 영향 없음) */
export function normalizeLineEndings(buffer) {
  const out = [];
  for (let i = 0; i < buffer.length; i += 1) {
    if (buffer[i] === 0x0d && buffer[i + 1] === 0x0a) continue;
    out.push(buffer[i]);
  }
  return Buffer.from(out);
}

/** SHA256.txt 한 줄("<해시> *<파일명>")에서 해시만 꺼냄 */
export function expectedHash(hashFileText) {
  const match = /^([0-9a-f]{64})\b/i.exec(hashFileText.trim());
  return match ? match[1].toLowerCase() : null;
}

/**
 * @returns {{ok: boolean, reason?: 'no-hash-file'|'bad-hash-file'|'mismatch', lineEndingsFixed?: boolean}}
 */
export function verifyDump(dumpBuffer, hashFileText) {
  if (hashFileText == null) return { ok: true, reason: 'no-hash-file' };
  const expected = expectedHash(hashFileText);
  if (!expected) return { ok: false, reason: 'bad-hash-file' };
  if (sha256(dumpBuffer) === expected) return { ok: true };
  if (sha256(normalizeLineEndings(dumpBuffer)) === expected) {
    return { ok: true, lineEndingsFixed: true };
  }
  return { ok: false, reason: 'mismatch' };
}
