/**
 * 푸시 토큰 등록·해제 (A15·A16) — tasks/mobile-client MC-11.
 *
 * **Firebase가 아직 없으면 이 파일은 아무것도 하지 않는다.**
 * `@react-native-firebase/messaging`을 필요한 순간에만 불러오고, 없으면 조용히 건너뛴다.
 * 그래서 `google-services.json`이 준비되기 전에도 앱이 그대로 돌아간다
 * (알림은 앱 안 알림함으로만 본다).
 *
 * 준비되면 할 일 (최정훈과 함께 `android/` 설정):
 *  1. `npm i @react-native-firebase/app @react-native-firebase/messaging`
 *  2. `android/app/google-services.json` 넣기 (**커밋하지 않는다**)
 *  3. `App.jsx`에서 로그인 직후 `registerPushDevice()`, 로그아웃 직전 `unregisterPushDevice()`
 *  4. 알림을 눌렀을 때 `onNotificationOpened(handler)`로 받아 `parseLinkScreen`으로 화면 이동
 */
import { Platform } from 'react-native';

import { registerPushDevice as apiRegister, unregisterPushDevice as apiUnregister } from '../client/api/meApi.js';
import { parseLinkScreen } from '../client/links.js';

/** 마지막으로 등록한 토큰. 로그아웃 때 이 값으로 해제한다. */
let currentToken = null;

/** Firebase가 들어와 있으면 messaging 모듈을, 아니면 `null`을 준다. */
async function loadMessaging() {
  try {
    const module = await import('@react-native-firebase/messaging');
    return module.default ?? module;
  } catch {
    return null;
  }
}

/**
 * 알림 권한을 확인하고 토큰을 서버에 등록한다 (A15). 로그인 직후에 부른다.
 * @returns {Promise<boolean>} 등록했으면 true, 건너뛰었으면 false
 */
export async function registerPushDevice() {
  const messaging = await loadMessaging();
  if (!messaging) return false;

  try {
    const authStatus = await messaging().requestPermission();
    // 1 = AUTHORIZED, 2 = PROVISIONAL
    if (authStatus !== 1 && authStatus !== 2) return false;

    const token = await messaging().getToken();
    if (!token) return false;

    await apiRegister({ platform: Platform.OS === 'ios' ? 'ios' : 'android', token });
    currentToken = token;
    return true;
  } catch {
    // 푸시가 안 되더라도 앱 사용에는 지장이 없다.
    return false;
  }
}

/**
 * 토큰을 해제한다 (A16). **로그아웃하기 직전**에 부른다 — 토큰이 아직 살아 있어야 한다.
 * @returns {Promise<void>}
 */
export async function unregisterPushDevice() {
  if (!currentToken) return;
  try {
    await apiUnregister(currentToken);
  } catch {
    // 서버에 못 알려도 로그아웃은 진행한다.
  } finally {
    currentToken = null;
  }
}

/**
 * 알림을 눌러 앱이 열렸을 때 갈 화면을 알려 준다.
 * 화면 쪽(`navigation/`)이 `handler({name, params})`를 받아 이동한다.
 *
 * @param {(target: {name: string, params: Record<string, string>}) => void} handler
 * @returns {Promise<() => void>} 구독 해제
 */
export async function onNotificationOpened(handler) {
  const messaging = await loadMessaging();
  if (!messaging) return () => {};

  const toTarget = (message) => parseLinkScreen(message?.data?.linkScreen);

  // 앱이 꺼져 있다가 알림으로 열린 경우
  try {
    const initial = await messaging().getInitialNotification();
    if (initial) handler(toTarget(initial));
  } catch {
    // 초기 알림을 못 읽어도 아래 구독은 건다.
  }

  try {
    return messaging().onNotificationOpenedApp((message) => handler(toTarget(message)));
  } catch {
    return () => {};
  }
}

export default { registerPushDevice, unregisterPushDevice, onNotificationOpened };
