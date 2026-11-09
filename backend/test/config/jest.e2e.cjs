const base = require('./jest.base.cjs');

module.exports = {
  ...base,
  testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.js'],
  // 약관 정책·레벨 정책 등 전역 상태를 공유하는 DB를 쓰므로 파일은 한 번에 하나씩 실행
  maxWorkers: 1,
  // argon2 해시도 CPU를 쓰므로 기본 5초는 빠듯함
  testTimeout: 30_000,
  // 앱 모듈이 import 시점에 환경 변수를 검증하므로 테스트용 키를 미리 주입
  setupFiles: ['<rootDir>/test/config/e2e-env.cjs'],
  setupFilesAfterEnv: [
    '<rootDir>/test/support/jest-compat.js',
    '<rootDir>/test/support/idempotency-key.js',
  ],
};
