const base = require('./jest.base.cjs');

// 단위 테스트: 외부 의존(DB 등) 없음
module.exports = {
  ...base,
  testMatch: ['<rootDir>/test/unit/**/*.spec.js'],
};
