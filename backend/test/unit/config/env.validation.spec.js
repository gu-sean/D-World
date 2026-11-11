import { validateEnv } from '../../../src/config/env.validation.js';

const base = {
  DATABASE_URL: 'postgres://localhost/d_world',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  ADMIN_JWT_SECRET: 'b'.repeat(32),
};

describe('validateEnv', () => {
  it('문자열을 타입 변환하고 기본값 채움', () => {
    const env = validateEnv({ ...base, PORT: '4000' });
    expect(env.PORT).toBe(4000);
    expect(env.DATABASE_POOL_MAX).toBe(10);
    expect(env.DATABASE_SSL).toBe(false);
    expect(env.NODE_ENV).toBe('development');
    expect(env.DATABASE_STATEMENT_TIMEOUT_MS).toBe(30_000);
    expect(env.DATABASE_IDLE_TX_TIMEOUT_MS).toBe(60_000);
    expect(env.ADMIN_WEB_ORIGIN).toBeUndefined();
    expect(env.ACCESS_TOKEN_TTL_SEC).toBe(1800);
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(30);
    expect(env.SMS_DRIVER).toBe('console');
    expect(env.TRUST_PROXY).toBe(false);
  });

  it('WEATHER_DRIVER=kma는 KMA_AUTH_KEY가 있어야 부팅', () => {
    expect(() => validateEnv({ ...base, WEATHER_DRIVER: 'kma' })).toThrow(
      /KMA_AUTH_KEY/,
    );
    const env = validateEnv({
      ...base,
      WEATHER_DRIVER: 'kma',
      KMA_AUTH_KEY: 'abc',
    });
    expect(env.WEATHER_DRIVER).toBe('kma');
    expect(validateEnv(base).WEATHER_DRIVER).toBe('mock');
  });

  it('DATABASE_URL 누락 시 부팅 차단', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('범위를 벗어난 값 거부', () => {
    expect(() => validateEnv({ ...base, PORT: '70000' })).toThrow(/PORT/);
    expect(() => validateEnv({ ...base, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV/,
    );
    expect(() =>
      validateEnv({ ...base, DATABASE_STATEMENT_TIMEOUT_MS: '10' }),
    ).toThrow(/DATABASE_STATEMENT_TIMEOUT_MS/);
  });

  it('JWT 키는 32자 이상이고 사용자·관리자 키가 달라야 함', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
    expect(() =>
      validateEnv({ ...base, ADMIN_JWT_SECRET: base.JWT_ACCESS_SECRET }),
    ).toThrow(/ADMIN_JWT_SECRET/);
    expect(() => validateEnv({ DATABASE_URL: base.DATABASE_URL })).toThrow(
      /JWT_ACCESS_SECRET.*ADMIN_JWT_SECRET/,
    );
  });

  it('운영 환경에서는 console 문자 발송 금지', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(
      /SMS_DRIVER/,
    );
  });

  it('푸시 발송 기본값은 console이고 운영 환경에서는 console 금지', () => {
    expect(validateEnv(base).PUSH_DRIVER).toBe('console');
    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'production', SMS_DRIVER: 'console' }),
    ).toThrow(/PUSH_DRIVER/);
  });

  it('팀 문서 환경 변수 기본값', () => {
    const env = validateEnv(base);
    expect(env.JOBS_DISABLED).toBe(false);
    expect(env.R2_KEY_PREFIX).toBe('dev');
    expect(env.R2_CREATE_BUCKET).toBe(false);
    expect(env.PHONE_CODE_PEPPER).toBeUndefined();
    expect(() => validateEnv({ ...base, PHONE_CODE_PEPPER: 'short' })).toThrow(
      /PHONE_CODE_PEPPER/,
    );
  });

  it('저장소 기본값은 memory이고 운영 환경에서는 memory 금지', () => {
    expect(validateEnv(base).STORAGE_DRIVER).toBe('memory');
    expect(validateEnv(base).R2_UPLOAD_URL_TTL_SEC).toBe(900);
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        SMS_DRIVER: 'console',
        STORAGE_DRIVER: 'memory',
      }),
    ).toThrow(/STORAGE_DRIVER/);
  });

  it('STORAGE_DRIVER=r2이면 R2 접속 정보가 모두 필요', () => {
    expect(() => validateEnv({ ...base, STORAGE_DRIVER: 'r2' })).toThrow(
      /R2_ACCOUNT_ID.*R2_ACCESS_KEY_ID.*R2_SECRET_ACCESS_KEY.*R2_BUCKET/,
    );
    const env = validateEnv({
      ...base,
      STORAGE_DRIVER: 'r2',
      R2_ACCOUNT_ID: 'acc',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_BUCKET: 'bucket',
    });
    expect(env.STORAGE_DRIVER).toBe('r2');
    expect(() => validateEnv({ ...base, R2_UPLOAD_URL_TTL_SEC: '10' })).toThrow(
      /R2_UPLOAD_URL_TTL_SEC/,
    );
  });

  it('INTERNAL_API_TOKEN은 없어도 되지만 있으면 32자 이상', () => {
    expect(validateEnv(base).INTERNAL_API_TOKEN).toBeUndefined();
    expect(
      validateEnv({ ...base, INTERNAL_API_TOKEN: 'a'.repeat(32) })
        .INTERNAL_API_TOKEN,
    ).toBe('a'.repeat(32));
    expect(() => validateEnv({ ...base, INTERNAL_API_TOKEN: 'short' })).toThrow(
      /INTERNAL_API_TOKEN/,
    );
  });
});

describe('validateEnv - FCM', () => {
  it('fcm 드라이버는 서비스 계정 정보가 필요', () => {
    expect(() => validateEnv({ ...base, PUSH_DRIVER: 'fcm' })).toThrow(
      /FCM_SERVICE_ACCOUNT_JSON/,
    );
    expect(
      validateEnv({
        ...base,
        PUSH_DRIVER: 'fcm',
        FCM_SERVICE_ACCOUNT_JSON: '{}',
      }).PUSH_DRIVER,
    ).toBe('fcm');
  });
});
