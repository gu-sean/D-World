/**
 * 화면 밖에서 화면을 옮길 때 쓰는 손잡이.
 *
 * 알림을 눌러 앱이 열렸을 때처럼 React 컴포넌트가 아닌 곳에서 이동해야 하는 경우가
 * 있다. `NavigationContainer`에 이 ref를 달아 두면 어디서든 `navigate()`를 부를 수 있다.
 *
 * 앱이 꺼져 있다가 알림으로 열리면 로그인 화면들이 준비되기 전에 이동 요청이 올 수 있다.
 * 그때는 마지막 요청 1건을 보관해 두었다가, 로그인 뒤 화면(`Routes.MAIN`)이 생기면
 * `flushPendingNavigation()`(컨테이너의 onReady·onStateChange)이 이어서 이동한다.
 */
import { createNavigationContainerRef } from '@react-navigation/native';

import Routes from './routes';

export const navigationRef = createNavigationContainerRef();

/** 아직 갈 수 없어 미뤄 둔 이동 `{name, params}` (마지막 1건만) */
let pending = null;

/** 로그인 뒤 화면들이 올라와 있어 바로 이동할 수 있는지 */
function canNavigateNow() {
  if (!navigationRef.isReady()) return false;
  const names = navigationRef.getRootState()?.routeNames ?? [];
  return names.includes(Routes.MAIN);
}

/**
 * @param {string} name 이동할 화면 이름 (`Routes.*`)
 * @param {object} [params]
 */
export function navigate(name, params) {
  if (canNavigateNow()) {
    pending = null;
    navigationRef.navigate(name, params);
  } else {
    pending = { name, params };
  }
}

/** 미뤄 둔 이동이 있고 이제 갈 수 있으면 이동한다. */
export function flushPendingNavigation() {
  if (!pending || !canNavigateNow()) return;
  const { name, params } = pending;
  pending = null;
  navigationRef.navigate(name, params);
}

/** 미뤄 둔 이동을 버린다 (로그아웃 등). */
export function clearPendingNavigation() {
  pending = null;
}

/** 뒤로 갈 곳이 있으면 한 칸 뒤로. */
export function goBack() {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack();
  }
}

export default navigationRef;
