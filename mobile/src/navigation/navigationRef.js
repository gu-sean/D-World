/**
 * 화면 밖에서 화면을 옮길 때 쓰는 손잡이.
 *
 * 알림을 눌러 앱이 열렸을 때처럼 React 컴포넌트가 아닌 곳에서 이동해야 하는 경우가
 * 있다. `NavigationContainer`에 이 ref를 달아 두면 어디서든 `navigate()`를 부를 수 있다.
 * 아직 준비되지 않았으면 조용히 무시한다.
 */
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

/**
 * @param {string} name 이동할 화면 이름 (`Routes.*`)
 * @param {object} [params]
 */
export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

/** 뒤로 갈 곳이 있으면 한 칸 뒤로. */
export function goBack() {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack();
  }
}

export default navigationRef;
