import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serviceAccountJson } from '../../../src/notices/push/push-sender.js';

const configOf = (values) => ({ get: (key) => values[key] });

describe('FCM 서비스 계정 JSON 읽기', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fcm-'));
  const file = join(dir, 'sa.json');
  writeFileSync(file, '{"from":"file"}');

  it('문자열이 있으면 그것을 씀', () => {
    expect(
      serviceAccountJson(
        configOf({
          FCM_SERVICE_ACCOUNT_JSON: '{"from":"inline"}',
          FCM_SERVICE_ACCOUNT_PATH: file,
        }),
      ),
    ).toBe('{"from":"inline"}');
  });

  it.each([[''], ['   '], [undefined]])(
    '문자열이 비어 있으면(%j) 파일을 읽음',
    (inline) => {
      expect(
        serviceAccountJson(
          configOf({
            FCM_SERVICE_ACCOUNT_JSON: inline,
            FCM_SERVICE_ACCOUNT_PATH: file,
          }),
        ),
      ).toBe('{"from":"file"}');
    },
  );
});
