export const NodeEnv = Object.freeze({
  Development: 'development',
  Production: 'production',
  Test: 'test',
});

export const SmsProvider = Object.freeze({
  Console: 'console',
});

export const StorageProvider = Object.freeze({
  R2: 'r2',
  Memory: 'memory',
});

const R2_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
];

const parseInteger = (min, max) => (raw) => {
  if (!/^-?\d+$/.test(raw)) return { error: '정수여야 함' };
  const value = Number(raw);
  if (value < min) return { error: `${min} 이상이어야 함` };
  if (max !== undefined && value > max) return { error: `${max} 이하여야 함` };
  return { value };
};

const parseBoolean = (raw) => {
  if (raw === 'true' || raw === '1') return { value: true };
  if (raw === 'false' || raw === '0') return { value: false };
  return { error: 'true 또는 false여야 함' };
};

const parseEnum = (allowed) => (raw) =>
  Object.values(allowed).includes(raw)
    ? { value: raw }
    : { error: `${Object.values(allowed).join(', ')} 중 하나여야 함` };

const parseString = (raw) => ({ value: raw });

const parseSecret = (raw) =>
  raw.length >= 32 ? { value: raw } : { error: '32자 이상이어야 함' };

// 값이 없으면 기본값, 기본값이 없고 required면 누락 오류
const SCHEMA = {
  NODE_ENV: { parse: parseEnum(NodeEnv), default: NodeEnv.Development },
  PORT: { parse: parseInteger(1, 65535), default: 3000 },
  /** 쉼표로 구분한 허용 Origin, 비우면 CORS 비활성 */
  CORS_ORIGINS: { parse: parseString },
  /** 리버스 프록시 뒤에서 X-Forwarded-For의 클라이언트 IP를 신뢰 */
  TRUST_PROXY: { parse: parseBoolean, default: false },
  DATABASE_URL: { parse: parseString, required: true },
  DATABASE_POOL_MAX: { parse: parseInteger(1, 100), default: 10 },
  DATABASE_SSL: { parse: parseBoolean, default: false },
  /** 쿼리 1건 최대 실행 시간 */
  DATABASE_STATEMENT_TIMEOUT_MS: { parse: parseInteger(1000), default: 30_000 },
  /** 트랜잭션을 열고 방치할 수 있는 최대 시간, 초과 시 서버가 연결 종료 */
  DATABASE_IDLE_TX_TIMEOUT_MS: { parse: parseInteger(1000), default: 60_000 },
  /** 사용자 access token 서명 키, 인증번호 해시 키로도 사용 */
  JWT_ACCESS_SECRET: { parse: parseSecret, required: true },
  /** 관리자 access token 서명 키, 사용자 키와 달라야 함 */
  ADMIN_JWT_SECRET: { parse: parseSecret, required: true },
  ACCESS_TOKEN_TTL_SEC: { parse: parseInteger(60, 3600), default: 1800 },
  ADMIN_ACCESS_TOKEN_TTL_SEC: { parse: parseInteger(60, 3600), default: 900 },
  REFRESH_TOKEN_TTL_DAYS: { parse: parseInteger(1, 90), default: 30 },
  /** 문자 발송 공급자, console은 개발 전용(인증번호를 로그에 출력) */
  SMS_PROVIDER: { parse: parseEnum(SmsProvider), default: SmsProvider.Console },
  APPLE_CLIENT_ID: { parse: parseString },
  /** 쉼표로 구분한 Google OAuth 클라이언트 ID(iOS·Android·웹) */
  GOOGLE_CLIENT_IDS: { parse: parseString },
  NAVER_PROFILE_URL: {
    parse: parseString,
    default: 'https://openapi.naver.com/v1/nid/me',
  },
  /** 인증 원본 저장소, memory는 개발·테스트 전용(운영 금지), r2는 아래 R2_* 필요 */
  STORAGE_PROVIDER: {
    parse: parseEnum(StorageProvider),
    default: StorageProvider.Memory,
  },
  /** S3 호환 저장소 주소(개발 MinIO 등), 비우면 R2_ACCOUNT_ID로 R2 주소 사용 */
  R2_ENDPOINT: { parse: parseString },
  R2_ACCOUNT_ID: { parse: parseString },
  R2_ACCESS_KEY_ID: { parse: parseString },
  R2_SECRET_ACCESS_KEY: { parse: parseString },
  R2_BUCKET: { parse: parseString },
  /** AI 서비스가 판정 결과를 보낼 때 쓰는 공유 비밀, 비우면 수신 엔드포인트가 꺼짐(503) */
  AI_INGEST_SECRET: { parse: parseSecret },
  /** 백엔드가 AI 서비스에 판정을 요청할 주소와 공유 비밀, 둘 다 있어야 요청 작업이 켜짐(규격 확정 전 임시) */
  AI_SERVICE_URL: { parse: parseString },
  AI_SERVICE_SECRET: { parse: parseSecret },
  /** true면 이 프로세스가 주기 작업(JobsModule)을 실행, 여러 인스턴스면 한쪽만 켜는 것을 권장 */
  JOBS_ENABLED: { parse: parseBoolean, default: false },
  /** 업로드 URL 유효 시간(초), 정책 05의 제안 5분 */
  R2_UPLOAD_URL_TTL_SEC: { parse: parseInteger(30, 3600), default: 300 },
};

export function validateEnv(config) {
  // 타입 변환 후 검증, 오류 시 부팅 실패
  const validated = {};
  const errors = [];

  for (const [key, spec] of Object.entries(SCHEMA)) {
    const raw = config[key];
    if (raw === undefined || raw === null || raw === '') {
      if (spec.required) errors.push(`${key}: 값이 필요함`);
      else if (spec.default !== undefined) validated[key] = spec.default;
      continue;
    }
    const result = spec.parse(String(raw));
    if (result.error) errors.push(`${key}: ${result.error}`);
    else validated[key] = result.value;
  }

  if (
    validated.JWT_ACCESS_SECRET &&
    validated.JWT_ACCESS_SECRET === validated.ADMIN_JWT_SECRET
  ) {
    errors.push('ADMIN_JWT_SECRET: JWT_ACCESS_SECRET과 달라야 함');
  }
  if (
    validated.NODE_ENV === NodeEnv.Production &&
    validated.SMS_PROVIDER === SmsProvider.Console
  ) {
    errors.push('SMS_PROVIDER: 운영 환경에서는 console 사용 불가');
  }
  if (
    validated.NODE_ENV === NodeEnv.Production &&
    validated.STORAGE_PROVIDER === StorageProvider.Memory
  ) {
    errors.push('STORAGE_PROVIDER: 운영 환경에서는 memory 사용 불가');
  }
  if (validated.STORAGE_PROVIDER === StorageProvider.R2) {
    for (const key of R2_KEYS) {
      if (key === 'R2_ACCOUNT_ID' && validated.R2_ENDPOINT) continue;
      if (!validated[key]) {
        errors.push(`${key}: STORAGE_PROVIDER=r2일 때 필요함`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`환경 변수 검증 실패 - ${errors.join('; ')}`);
  }
  return validated;
}
