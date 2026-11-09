/**
 * 권한 확인·요청 (parts/mobile-ui §8의 `react-native-permissions`).
 *
 * 화면은 네 가지 이름만 안다: `'camera'` · `'location'` · `'activity'` · `'notifications'`.
 * 결과도 네 가지뿐이다:
 *  - `'granted'`   허용됨
 *  - `'denied'`    아직 거절 — 다시 물어볼 수 있다
 *  - `'blocked'`   "다시 묻지 않음" — `openSettings()`로 보내야 한다
 *  - `'unavailable'` 이 기기에 없는 기능 (예: 걸음 센서 없음)
 *
 * 권한을 설명하는 문구는 화면(VERIFY-02·SITUATION-02)이 갖는다.
 */
import { Platform } from 'react-native';
import {
  PERMISSIONS,
  RESULTS,
  check as rnCheck,
  request as rnRequest,
  checkNotifications,
  requestNotifications,
  openSettings as rnOpenSettings,
} from 'react-native-permissions';

/** @typedef {'camera'|'location'|'activity'|'notifications'} PermissionKind */
/** @typedef {'granted'|'denied'|'blocked'|'unavailable'} PermissionStatus */

/** MVP는 Android만 빌드한다 (12 §1). iOS 값은 나중을 위해 함께 둔다. */
function permissionFor(kind) {
  const android = Platform.OS === 'android';
  switch (kind) {
    case 'camera':
      return android ? PERMISSIONS.ANDROID.CAMERA : PERMISSIONS.IOS.CAMERA;
    case 'location':
      return android
        ? PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION
        : PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
    case 'activity':
      return android ? PERMISSIONS.ANDROID.ACTIVITY_RECOGNITION : PERMISSIONS.IOS.MOTION;
    default:
      return null;
  }
}

/** 라이브러리 결과(5가지)를 우리 4가지로 줄인다. `limited`는 쓸 수 있으므로 granted로 본다. */
function toStatus(result) {
  switch (result) {
    case RESULTS.GRANTED:
    case RESULTS.LIMITED:
      return 'granted';
    case RESULTS.DENIED:
      return 'denied';
    case RESULTS.BLOCKED:
      return 'blocked';
    default:
      return 'unavailable';
  }
}

/**
 * 지금 권한 상태 (물어보지 않는다).
 * @param {PermissionKind} kind
 * @returns {Promise<PermissionStatus>}
 */
export async function check(kind) {
  try {
    if (kind === 'notifications') {
      const { status } = await checkNotifications();
      return toStatus(status);
    }
    const permission = permissionFor(kind);
    if (!permission) return 'unavailable';
    return toStatus(await rnCheck(permission));
  } catch {
    return 'unavailable';
  }
}

/**
 * 권한을 요청한다 (기기 팝업이 뜬다).
 * @param {PermissionKind} kind
 * @returns {Promise<PermissionStatus>}
 */
export async function request(kind) {
  try {
    if (kind === 'notifications') {
      const { status } = await requestNotifications(['alert', 'sound', 'badge']);
      return toStatus(status);
    }
    const permission = permissionFor(kind);
    if (!permission) return 'unavailable';
    return toStatus(await rnRequest(permission));
  } catch {
    return 'unavailable';
  }
}

/**
 * 이미 허용돼 있으면 그대로, 아니면 한 번 요청한다.
 * @param {PermissionKind} kind
 * @returns {Promise<PermissionStatus>}
 */
export async function ensure(kind) {
  const current = await check(kind);
  if (current === 'granted' || current === 'blocked' || current === 'unavailable') return current;
  return request(kind);
}

/** 앱 설정 화면을 연다 (`blocked`일 때). */
export async function openSettings() {
  try {
    await rnOpenSettings();
  } catch {
    // 설정을 열지 못해도 앱이 죽지는 않게 한다.
  }
}

export const permissions = { check, request, ensure, openSettings };

export default permissions;
