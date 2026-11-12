/**
 * 린트 설정.
 *
 * React Native 기본 규칙을 쓰고, 이 프로젝트에 맞춰 두 가지만 손봤다.
 *   - 화면은 .jsx, 기능 모듈은 .js 로 나누므로 둘 다 JSX를 허용한다
 *   - 안드로이드 빌드 산출물과 기능 모듈 테스트 도우미는 검사하지 않는다
 */
module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: ['android/', 'ios/', 'node_modules/'],
  rules: {
    'react-native/no-inline-styles': 'off',
  },
};
