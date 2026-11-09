import { z } from 'zod';

const NodeEnv = Object.freeze({
  Development: 'development',
  Production: 'production',
  Test: 'test',
});

const SmsProvider = Object.freeze({
  Console: 'console',
});

const PushProvider = Object.freeze({
  Console: 'console',
  Fcm: 'fcm',
});

const SocialDriver = Object.freeze({
  Real: 'real',
  Mock: 'mock',
});

const StorageProvider = Object.freeze({
  R2: 'r2',
  Memory: 'memory',
});

const R2_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
];

// 빈 문자열은 "값 없음"으로 취급(.env의 `KEY=`)
const blankToUndefined = (value) =>
  value === '' || value === null ? undefined : value;
const optional = (schema) => z.preprocess(blankToUndefined, schema.optional());
const withDefault = (schema, value) =>
  z.preprocess(blankToUndefined, schema.default(value));
const required = (schema) => z.preprocess(blankToUndefined, schema);

const integer = (min, max) => {
  let schema = z
    .string()
    .or(z.number())
    .transform(String)
    .pipe(z.string().regex(/^-?\d+$/, '정수여야 함'))
    .transform(Number)
    .pipe(z.number().min(min, `${min} 이상이어야 함`));
  if (max !== undefined) {
    schema = schema.pipe(z.number().max(max, `${max} 이하여야 함`));
  }
  return schema;
};

const boolean = z
  .union([z.boolean(), z.string()])
  .transform(String)
  .pipe(
    z.enum(['true', '1', 'false', '0'], {
      error: 'true 또는 false여야 함',
    }),
  )
  .transform((raw) => raw === 'true' || raw === '1');

const enumOf = (allowed) =>
  z.enum(Object.values(allowed), {
    error: `${Object.values(allowed).join(', ')} 중 하나여야 함`,
  });

const secret = z.string({ error: '값이 필요함' }).min(32, '32자 이상이어야 함');

// 값이 없으면 기본값, 기본값이 없고 required면 누락 오류
const SCHEMA = z.object({
  NODE_ENV: withDefault(enumOf(NodeEnv), NodeEnv.Development),
  PORT: withDefault(integer(1, 65535), 3000),
  /** 관리자 웹 Origin(쉼표로 여럿 가능), 비우면 CORS 비활성 */
  ADMIN_WEB_ORIGIN: optional(z.string()),
  /** 리버스 프록시 뒤에서 X-Forwarded-For의 클라이언트 IP를 신뢰 */
  TRUST_PROXY: withDefault(boolean, false),
  DATABASE_URL: required(z.string({ error: '값이 필요함' })),
  DATABASE_POOL_MAX: withDefault(integer(1, 100), 10),
  DATABASE_SSL: withDefault(boolean, false),
  /** 쿼리 1건 최대 실행 시간 */
  DATABASE_STATEMENT_TIMEOUT_MS: withDefault(integer(1000), 30_000),
  /** 트랜잭션을 열고 방치할 수 있는 최대 시간, 초과 시 서버가 연결 종료 */
  DATABASE_IDLE_TX_TIMEOUT_MS: withDefault(integer(1000), 60_000),
  /** 사용자 access token 서명 키, 인증번호 해시 키로도 사용 */
  JWT_ACCESS_SECRET: required(secret),
  /** 관리자 access token 서명 키, 사용자 키와 달라야 함 */
  ADMIN_JWT_SECRET: required(secret),
  ACCESS_TOKEN_TTL_SEC: withDefault(integer(60, 3600), 1800),
  ADMIN_ACCESS_TOKEN_TTL_SEC: withDefault(integer(60, 3600), 900),
  REFRESH_TOKEN_TTL_DAYS: withDefault(integer(1, 90), 30),
  /** 문자 발송 공급자, console은 개발 전용(인증번호를 로그에 출력) */
  SMS_DRIVER: withDefault(enumOf(SmsProvider), SmsProvider.Console),
  /** 푸시 발송 공급자, console은 개발 전용, fcm일 때만 firebase-admin 초기화 */
  PUSH_DRIVER: withDefault(enumOf(PushProvider), PushProvider.Console),
  /** PUSH_DRIVER=fcm: 서비스 계정 JSON 문자열(FCM_SERVICE_ACCOUNT_PATH가 없을 때) */
  FCM_SERVICE_ACCOUNT_JSON: optional(z.string()),
  /** PUSH_DRIVER=fcm: 서비스 계정 JSON 파일 경로 */
  FCM_SERVICE_ACCOUNT_PATH: optional(z.string()),
  /** 소셜 검증 방식, mock은 `mock:{subject}:{email}` 형식 토큰을 그대로 믿는 개발 전용(운영 금지) */
  SOCIAL_DRIVER: withDefault(enumOf(SocialDriver), SocialDriver.Real),
  /** 날씨 조회 방식, mock은 항상 맑음 20도, openweather는 OPENWEATHER_API_KEY, kma는 KMA_AUTH_KEY 필요(실패하면 날씨 없이 추천) */
  WEATHER_DRIVER: withDefault(z.enum(['mock', 'openweather', 'kma']), 'mock'),
  OPENWEATHER_API_KEY: optional(z.string()),
  /** WEATHER_DRIVER=kma: 기상청 API허브(apihub.kma.go.kr) 인증키 */
  KMA_AUTH_KEY: optional(z.string()),
  APPLE_CLIENT_ID: optional(z.string()),
  /** 쉼표로 구분한 Google OAuth 클라이언트 ID(iOS·Android·웹) */
  GOOGLE_CLIENT_IDS: optional(z.string()),
  NAVER_PROFILE_URL: withDefault(
    z.string(),
    'https://openapi.naver.com/v1/nid/me',
  ),
  /** 인증 원본 저장소, memory는 개발·테스트 전용(운영 금지), r2는 아래 R2_* 필요 */
  STORAGE_DRIVER: withDefault(enumOf(StorageProvider), StorageProvider.Memory),
  /** S3 호환 저장소 주소(개발 MinIO 등), 비우면 R2_ACCOUNT_ID로 R2 주소 사용 */
  R2_ENDPOINT: optional(z.string()),
  R2_ACCOUNT_ID: optional(z.string()),
  R2_ACCESS_KEY_ID: optional(z.string()),
  R2_SECRET_ACCESS_KEY: optional(z.string()),
  R2_BUCKET: optional(z.string()),
  /** 내부 호출(AI ↔ 백엔드) 공유 토큰, X-Internal-Token 헤더, 비우면 수신 엔드포인트가 꺼짐(503) */
  INTERNAL_API_TOKEN: optional(secret),
  /** AI 서버 주소(호스트까지, 끝의 /internal/v1은 있어도 없어도 됨), INTERNAL_API_TOKEN과 둘 다 있어야 판정 요청 작업이 켜짐 */
  AI_SERVICE_URL: optional(z.string()),
  /** AI가 콜백을 보낼 이 백엔드의 공개 주소(끝 슬래시 없이), AI의 BACKEND_CALLBACK_URL이 `{값}/internal/v1/ai-callbacks`와 같아야 함, 비우면 http://localhost:PORT */
  BACKEND_PUBLIC_URL: optional(z.string()),
  /** AI 서버 호출 기본 타임아웃(ms), 판정 접수 기준 */
  /** 판정 요청(I01)에 파일을 알려 주는 방식: object_key(키만, AI가 저장소에서 직접), signed_url(키와 읽기용 서명 URL, AI 스키마에 downloadUrl 필드가 있어야 함) */
  AI_MEDIA_ACCESS: withDefault(
    z.enum(['object_key', 'signed_url']),
    'object_key',
  ),
  AI_REQUEST_TIMEOUT_MS: withDefault(integer(1000, 120_000), 10_000),
  /** 계획 생성(I03) 타임아웃(ms), 앱은 70초까지 기다림 */
  AI_PLAN_TIMEOUT_MS: withDefault(integer(1000, 120_000), 60_000),
  /** 상황 추천(I04) 타임아웃(ms), 넘으면 규칙 기반으로 대체 */
  AI_RECOMMEND_TIMEOUT_MS: withDefault(integer(1000, 120_000), 15_000),
  /** true면 이 프로세스의 정기 작업(JobsModule)을 끔(테스트·보조 인스턴스용) */
  JOBS_DISABLED: withDefault(boolean, false),
  /** 멱등 키 보관 시간(시간), 지나면 정기 작업이 삭제 */
  IDEMPOTENCY_RETENTION_HOURS: withDefault(integer(1, 8760), 24),
  /** 업로드 URL 유효 시간(초), 팀 문서 기준 15분 */
  R2_UPLOAD_URL_TTL_SEC: withDefault(integer(30, 3600), 900),
  /** 객체 키 맨 앞 접두어(환경 구분), 슬래시 없이 */
  R2_KEY_PREFIX: withDefault(z.string(), 'dev'),
  /** true면 시작할 때 버킷이 없으면 생성(로컬 MinIO 전용) */
  R2_CREATE_BUCKET: withDefault(boolean, false),
  /** 인증번호 해시에 섞는 서버 비밀, 비우면 JWT_ACCESS_SECRET 사용 */
  PHONE_CODE_PEPPER: optional(secret),
});

export function validateEnv(config) {
  // 타입 변환 후 검증, 오류 시 부팅 실패
  const parsed = SCHEMA.safeParse(config);
  const errors = [];
  let validated = {};

  if (parsed.success) {
    // 값이 없는 선택 항목은 키 자체를 두지 않음(기존 동작 유지)
    validated = Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined),
    );
  } else {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.join('.')}: ${issue.message}`);
    }
  }

  if (
    validated.JWT_ACCESS_SECRET &&
    validated.JWT_ACCESS_SECRET === validated.ADMIN_JWT_SECRET
  ) {
    errors.push('ADMIN_JWT_SECRET: JWT_ACCESS_SECRET과 달라야 함');
  }
  if (
    validated.NODE_ENV === NodeEnv.Production &&
    validated.SMS_DRIVER === SmsProvider.Console
  ) {
    errors.push('SMS_DRIVER: 운영 환경에서는 console 사용 불가');
  }
  if (
    validated.NODE_ENV === NodeEnv.Production &&
    validated.PUSH_DRIVER === PushProvider.Console
  ) {
    errors.push('PUSH_DRIVER: 운영 환경에서는 console 사용 불가');
  }
  if (
    validated.NODE_ENV === NodeEnv.Production &&
    validated.STORAGE_DRIVER === StorageProvider.Memory
  ) {
    errors.push('STORAGE_DRIVER: 운영 환경에서는 memory 사용 불가');
  }
  if (
    validated.NODE_ENV === NodeEnv.Production &&
    validated.SOCIAL_DRIVER === SocialDriver.Mock
  ) {
    errors.push('SOCIAL_DRIVER: 운영 환경에서는 mock 사용 불가');
  }
  if (validated.WEATHER_DRIVER === 'kma' && !validated.KMA_AUTH_KEY) {
    errors.push('KMA_AUTH_KEY: WEATHER_DRIVER=kma일 때 필요함');
  }
  if (
    validated.PUSH_DRIVER === PushProvider.Fcm &&
    !validated.FCM_SERVICE_ACCOUNT_JSON &&
    !validated.FCM_SERVICE_ACCOUNT_PATH
  ) {
    errors.push(
      'FCM_SERVICE_ACCOUNT_JSON: PUSH_DRIVER=fcm일 때 JSON 또는 FCM_SERVICE_ACCOUNT_PATH 필요함',
    );
  }
  if (validated.STORAGE_DRIVER === StorageProvider.R2) {
    for (const key of R2_KEYS) {
      if (key === 'R2_ACCOUNT_ID' && validated.R2_ENDPOINT) continue;
      if (!validated[key]) {
        errors.push(`${key}: STORAGE_DRIVER=r2일 때 필요함`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`환경 변수 검증 실패 - ${errors.join('; ')}`);
  }
  return validated;
}
