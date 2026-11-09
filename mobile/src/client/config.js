/**
 * 환경 변수 읽기 (12 §8.4 `mobile/.env.example`).
 *
 * `react-native-config`가 주는 값은 모두 문자열이거나 `undefined`다.
 * 여기서 한 번만 기본값·타입을 정리해서 내보낸다.
 * 앱에 들어간 값은 모두 공개된다고 가정한다 — 비밀값을 넣지 않는다.
 */
import Config from 'react-native-config';

/** 문자열 'true'만 true로 본다. */
function flag(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

function text(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

export const config = {
  /** 앱 API 기본 주소. 끝에 `/`가 있으면 떼어 둔다 (경로가 `/`로 시작하므로). */
  API_BASE_URL: text(Config.API_BASE_URL, 'http://localhost:3000/api/v1').replace(/\/+$/, ''),
  /** 'development' | 'production' */
  APP_ENV: text(Config.APP_ENV, 'development'),
  /** true면 `src/client/mock/`의 가짜 응답을 쓴다 (백엔드 없이 화면 개발). */
  USE_MOCK_API: flag(Config.USE_MOCK_API, false),
  /** 'mock'이면 소셜 로그인이 SDK를 부르지 않는다 (12 §8.4). */
  SOCIAL_LOGIN_MODE: text(Config.SOCIAL_LOGIN_MODE, 'mock'),
  /** 러닝 파일 `device.appVersion`·A45 `clientMetrics.appVersion`에 넣는 값. */
  APP_VERSION: text(Config.APP_VERSION, '0.1.0'),
};

/** 개발 빌드인지. 디버그 로그는 이 값이 true일 때만 남긴다 (parts/mobile-client §1.4). */
export const isDev = config.APP_ENV !== 'production';

export default config;
