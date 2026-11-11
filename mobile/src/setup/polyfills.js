/**
 * 앱이 시작할 때 가장 먼저 불러야 하는 폴리필.
 *
 * `mobile/index.js`(최정훈)의 첫 줄에서 `import './src/setup/polyfills';`로 부른다.
 * `react-native-get-random-values`는 `crypto.getRandomValues`를 깔아 주고,
 * 그 위에서 `uuid`의 v4가 동작한다 (멱등 키·X-Request-Id).
 *
 * 부작용만 있는 모듈이므로 내보내는 값은 없다.
 */
import 'react-native-get-random-values';
