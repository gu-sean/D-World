import {
  expectedHash,
  normalizeLineEndings,
  verifyDump,
} from '../../../scripts/demo-dump-verify.mjs';
import { createHash } from 'node:crypto';

const hashOf = (text) => createHash('sha256').update(text).digest('hex');

describe('scripts/demo-dump-verify.mjs', () => {
  const lf = Buffer.from('SELECT 1;\nSELECT 2;\n');
  const line = `${hashOf(lf)} *d_world_demo.sql\n`;

  it('해시가 같으면 통과', () => {
    expect(verifyDump(lf, line)).toEqual({ ok: true });
  });

  it('줄바꿈만 CRLF로 바뀐 경우는 통과하되 알려 줌', () => {
    const crlf = Buffer.from('SELECT 1;\r\nSELECT 2;\r\n');
    expect(verifyDump(crlf, line)).toEqual({
      ok: true,
      lineEndingsFixed: true,
    });
  });

  it('내용이 다르면 거부', () => {
    expect(verifyDump(Buffer.from('SELECT 3;\n'), line)).toEqual({
      ok: false,
      reason: 'mismatch',
    });
  });

  it('해시 파일이 없으면 검증을 건너뜀, 형식이 이상하면 거부', () => {
    expect(verifyDump(lf, null)).toEqual({ ok: true, reason: 'no-hash-file' });
    expect(verifyDump(lf, 'oops')).toEqual({
      ok: false,
      reason: 'bad-hash-file',
    });
  });

  it('보조 함수', () => {
    expect(expectedHash(line)).toBe(hashOf(lf));
    expect(normalizeLineEndings(Buffer.from('a\r\nb\rc\n')).toString()).toBe(
      'a\nb\rc\n',
    );
  });
});
