/**
 * 앱 전체를 감싸는 기능 모듈 제공자 (parts/mobile-client §2).
 *
 * `App.jsx`(최정훈)가 화면 트리의 가장 바깥에서 한 번 쓴다:
 *
 * ```jsx
 * import { ClientProvider } from './src/client';
 * export default function App() {
 *   return <ClientProvider><Navigation /></ClientProvider>;
 * }
 * ```
 *
 * 하는 일 세 가지:
 *  1. QueryClient를 만들어 내려 준다 (parts/mobile-client §5.2 기본값).
 *  2. `AppState`를 `focusManager`에 연결한다 — 앱이 돌아오면 다시 불러온다.
 *  3. 키체인의 토큰으로 세션을 되살린다. 그동안 `useSession().status`는 `'restoring'`.
 *
 * JSX를 쓰지 않는 이유: 이 파일은 기능 모듈 쪽 소유라 화면 빌드 설정에 기대지 않는다.
 */
import { createElement, useEffect, useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { createQueryClient, setupFocusManager } from '../client/queries/queryClient.js';
import session from '../client/auth/session.js';

/**
 * @param {{children: any, queryClient?: import('@tanstack/react-query').QueryClient}} props
 *        `queryClient`는 테스트·스토리북에서만 넘긴다.
 */
export function ClientProvider({ children, queryClient: provided }) {
  const queryClient = useMemo(() => provided ?? createQueryClient(), [provided]);

  useEffect(() => {
    session.attachQueryClient(queryClient);
    const teardownFocus = setupFocusManager();
    session.restore();
    return () => {
      teardownFocus?.();
    };
  }, [queryClient]);

  return createElement(QueryClientProvider, { client: queryClient }, children);
}

export default ClientProvider;
