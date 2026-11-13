import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ENV_FILE = resolve(process.cwd(), 'test/config/e2e-env.cjs');

/** e2e-env.cjs를 깨끗한 프로세스에서 불러 보고, 그 뒤의 환경 변수를 돌려준다 */
function loadWith(env) {
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      `require(${JSON.stringify(ENV_FILE)});
       const keys = ['JWT_ACCESS_SECRET','ADMIN_JWT_SECRET','JOBS_DISABLED','INTERNAL_API_TOKEN','WEATHER_DRIVER','KMA_AUTH_KEY','OPENWEATHER_API_KEY'];
       console.log(JSON.stringify(Object.fromEntries(keys.map((k) => [k, process.env[k] ?? null]))));`,
    ],
    // PATH만 남기고 나머지는 비워서 이 테스트를 돌리는 셸의 값이 새지 않게 한다
    {
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        ...env,
      },
      encoding: 'utf8',
    },
  );
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout.trim());
}

describe('test/config/e2e-env.cjs', () => {
  it('아무것도 없으면 테스트용 값으로 채움', () => {
    const env = loadWith({});
    expect(env.JWT_ACCESS_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.ADMIN_JWT_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.JWT_ACCESS_SECRET).not.toBe(env.ADMIN_JWT_SECRET);
    expect(env.INTERNAL_API_TOKEN.length).toBeGreaterThanOrEqual(32);
    expect(env.JOBS_DISABLED).toBe('true');
  });

  it('.env.example에서 복사한 빈 값은 덮어씀 (이전에는 ??= 라서 빈 채로 남았음)', () => {
    const env = loadWith({
      JWT_ACCESS_SECRET: '',
      ADMIN_JWT_SECRET: '',
      INTERNAL_API_TOKEN: '',
      JOBS_DISABLED: '',
    });
    expect(env.INTERNAL_API_TOKEN).not.toBe('');
    expect(env.JWT_ACCESS_SECRET).not.toBe('');
    expect(env.ADMIN_JWT_SECRET).not.toBe('');
    expect(env.JOBS_DISABLED).toBe('true');
  });

  it('셸에서 명시한 값은 그대로 존중', () => {
    const env = loadWith({
      INTERNAL_API_TOKEN: 'my-explicit-token-0123456789-abcdefghijkl',
      JOBS_DISABLED: 'false',
    });
    expect(env.INTERNAL_API_TOKEN).toBe(
      'my-explicit-token-0123456789-abcdefghijkl',
    );
    expect(env.JOBS_DISABLED).toBe('false');
  });

  it('날씨는 항상 mock으로 고정하고 외부 키는 지움 (.env 값이 새지 않게)', () => {
    const env = loadWith({
      WEATHER_DRIVER: 'kma',
      KMA_AUTH_KEY: 'real-key',
      OPENWEATHER_API_KEY: 'real-key-2',
    });
    expect(env.WEATHER_DRIVER).toBe('mock');
    expect(env.KMA_AUTH_KEY).toBeNull();
    expect(env.OPENWEATHER_API_KEY).toBeNull();
  });
});
