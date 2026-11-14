import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sslOptions } from '../../../src/database/database.service.js';

describe('DB TLS 옵션', () => {
  it('꺼져 있으면 TLS를 쓰지 않음', () => {
    expect(sslOptions(false, 'x.crt')).toBeUndefined();
  });

  it('켜면 항상 서버 인증서를 검증', () => {
    expect(sslOptions(true, undefined)).toEqual({ rejectUnauthorized: true });
  });

  it('CA 파일이 있으면 그 CA로 검증', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ca-'));
    const file = join(dir, 'ca.crt');
    writeFileSync(
      file,
      '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----\n',
    );
    expect(sslOptions(true, file)).toEqual({
      rejectUnauthorized: true,
      ca: expect.stringContaining('BEGIN CERTIFICATE'),
    });
  });
});
