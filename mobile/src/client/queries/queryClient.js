/**
 * QueryClient 기본값 (parts/mobile-client §5.2 끝).
 *
 *  - `staleTime` 30초, `gcTime` 5분
 *  - 조회 재시도는 **네트워크 오류일 때만** 2번. 400·409 같은 업무 오류는 다시 보내도 같다
 *  - 변경은 재시도하지 않는다 (05 §5.3 — "다시 시도" 버튼을 준다)
 *  - 앱이 포그라운드로 오면 `focusManager`를 통해 다시 불러온다
 */
import { AppState } from 'react-native';
import { QueryClient, focusManager } from '@tanstack/react-query';

export const STALE_TIME_MS = 30 * 1000;
export const GC_TIME_MS = 5 * 60 * 1000;
export const QUERY_RETRY_COUNT = 2;

/**
 * 네트워크 때문에 실패했을 때만 다시 보낸다.
 * @param {number} failureCount 이미 실패한 횟수
 * @param {import('../http/AppError.js').AppError} error
 */
export function shouldRetryQuery(failureCount, error) {
  if (failureCount >= QUERY_RETRY_COUNT) return false;
  return error?.code === 'NETWORK_ERROR' || error?.code === 'NETWORK_TIMEOUT';
}

/**
 * 앱 전체가 함께 쓰는 QueryClient를 만든다.
 * @returns {QueryClient}
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        gcTime: GC_TIME_MS,
        retry: shouldRetryQuery,
        // RN에는 창 포커스가 없다. 대신 아래 setupFocusManager가 AppState를 연결한다.
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * `AppState`를 `focusManager`에 연결한다. `ClientProvider`가 한 번 부른다.
 * @returns {() => void} 해제 함수
 */
export function setupFocusManager() {
  return focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      handleFocus(nextState === 'active');
    });
    return () => subscription.remove();
  });
}

export default createQueryClient;
