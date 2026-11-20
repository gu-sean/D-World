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
 *  4. 알림을 눌렀을 때 `onNotificationOpened(handler)`로 받아 `navigation/linking`의 `openLink`로 화면 이동
 */
import { Platform } from 'react-native';

import { registerPushDevice as apiRegister, unregisterPushDevice as apiUnregister } from '../client/api/meApi.js';
import permissions from '../client/device/permissions.js';

/** 마지막으로 등록한 토큰. 로그아웃 때 이 값으로 해제한다. */
let currentToken = null;

/** Firebase가 들어와 있으면 messaging 모듈(모듈식 API)을, 아니면 `null`을 준다. */
async function loadMessaging() {
  try {
    return await import('@react-native-firebase/messaging');
  } catch {
    return null;
  }
}

/**
 * 휴대폰 알림 권한을 요청한다. 이미 허용돼 있으면 묻지 않는다.
 *
 * Android 13+(POST_NOTIFICATIONS)는 사용자가 허용하기 전까지 알림이 꺼져 있어, 앱이 직접 물어야
 * 홈 화면에 "인증이 승인됐어요" 같은 푸시가 뜬다. Firebase의 `requestPermission()`은 Android에서
 * 창을 띄우지 않고 항상 허용(1)만 돌려주므로 쓰지 않고 `react-native-permissions`로 묻는다.
 * 앱을 켤 때마다(로그인 상태가 될 때마다) 부르므로, 거절하면 다음에 켤 때 다시 묻는다.
 * Android가 더 묻지 못하게 막은 뒤(두 번 거절)에는 창 없이 `'blocked'`가 돌아온다.
 *
 * @returns {Promise<'granted'|'denied'|'blocked'|'unavailable'>}
 */
export async function requestNotificationPermission() {
  const current = await permissions.check('notifications');
  if (current === 'granted' || current === 'unavailable') return current;
  return permissions.request('notifications');
}

/**
 * 토큰을 서버에 등록한다 (A15). 알림 권한이 켜져 있을 때만 등록한다 (묻지는 않는다 —
 * 묻는 것은 `requestNotificationPermission`). 로그인 직후와 설정에서 알림을 켜고 돌아왔을 때 부른다.
 * @returns {Promise<boolean>} 등록했으면 true, 건너뛰었으면 false
 */
export async function registerPushDevice() {
  const fm = await loadMessaging();
  if (!fm) return false;

  try {
    const messaging = fm.getMessaging();
    if (Platform.OS === 'ios') {
      const authStatus = await fm.requestPermission(messaging);
      // 1 = AUTHORIZED, 2 = PROVISIONAL
      if (authStatus !== 1 && authStatus !== 2) return false;
    } else if ((await permissions.check('notifications')) !== 'granted') {
      return false;
    }

    const token = await fm.getToken(messaging);
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
 * FCM이 기기 토큰을 새로 바꿔 주면 바로 서버에 다시 등록한다 (A15).
 * 로그인된 동안만 구독한다. 로그아웃 때 해제할 토큰도 새 것으로 바뀐다.
 * @returns {Promise<() => void>} 구독 해제
 */
export async function onPushTokenRefresh() {
  const fm = await loadMessaging();
  if (!fm) return () => {};
  try {
    return fm.onTokenRefresh(fm.getMessaging(), async (token) => {
      if (!token || token === currentToken) return;
      try {
        await apiRegister({ platform: Platform.OS === 'ios' ? 'ios' : 'android', token });
        currentToken = token;
      } catch {
        // 등록에 실패해도 다음 로그인·앱 실행 때 `registerPushDevice`가 다시 등록한다.
      }
    });
  } catch {
    return () => {};
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
 * 화면 쪽(`App.jsx`)이 `handler(linkScreen)`을 받아 `openLink`로 이동한다. 없으면 `null`(홈).
 *
 * @param {(linkScreen: string|null) => void} handler
 * @returns {Promise<() => void>} 구독 해제
 */
export async function onNotificationOpened(handler) {
  const fm = await loadMessaging();
  if (!fm) return () => {};
  const messaging = fm.getMessaging();

  const toTarget = (message) => message?.data?.linkScreen ?? null;

  // 앱이 꺼져 있다가 알림으로 열린 경우
  try {
    const initial = await fm.getInitialNotification(messaging);
    if (initial) handler(toTarget(initial));
  } catch {
    // 초기 알림을 못 읽어도 아래 구독은 건다.
  }

  try {
    return fm.onNotificationOpenedApp(messaging, (message) => handler(toTarget(message)));
  } catch {
    return () => {};
  }
}

/**
 * 앱을 보고 있는 동안 도착한 푸시를 받는다.
 * Android는 이때 알림창에 띄우지 않고 앱에 넘기므로, 앱이 직접 보여 줘야 한다(`InAppNotice`).
 *
 * @param {(message: {title: string, body: string, linkScreen: string|null}) => void} handler
 * @returns {Promise<() => void>} 구독 해제
 */
export async function onForegroundMessage(handler) {
  const fm = await loadMessaging();
  if (!fm) return () => {};
  try {
    return fm.onMessage(fm.getMessaging(), (message) => {
      handler({
        title: message?.notification?.title ?? '',
        body: message?.notification?.body ?? '',
        linkScreen: message?.data?.linkScreen ?? null,
      });
    });
  } catch {
    return () => {};
  }
}

export default {
  requestNotificationPermission,
  registerPushDevice,
  unregisterPushDevice,
  onNotificationOpened,
  onForegroundMessage,
  onPushTokenRefresh,
};
