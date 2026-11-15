/**
 * 루트 컴포넌트. 앱 전체를 감싸는 네 겹을 쌓는다.
 *
 * ErrorBoundary     그리기 오류가 나도 앱이 멈추지 않게 안내 화면과 "다시 시도"를 보여 준다.
 * ClientProvider    서버 통신·캐시·세션을 준비하고, 저장된 토큰으로 로그인을 되살린다.
 * SafeAreaProvider  노치·홈 인디케이터를 피할 여백 값을 화면들에 내려 준다.
 * RootNavigator     세션 상태에 따라 스플래시 / 로그인 / 메인 탭 중 하나를 띄운다.
 *
 * 상태 바는 밝은 배경에 맞춰 어두운 글씨로 고정한다.
 */
import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ClientProvider, useSession } from './src/client';
import ErrorBoundary from './src/components/ErrorBoundary';
import RootNavigator from './src/navigation/RootNavigator';
import { registerPushDevice } from './src/setup/pushRegistration';
import { colors } from './src/theme';

/** 로그인된 동안 기기의 푸시 토큰을 서버에 등록한다(등록 해제는 로그아웃 직전에 `useLogout`이 한다). */
function PushRegistrar() {
  const { status } = useSession();
  useEffect(() => {
    if (status === 'signedIn') registerPushDevice();
  }, [status]);
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ClientProvider>
        <SafeAreaProvider>
          <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
          <PushRegistrar />
          <RootNavigator />
        </SafeAreaProvider>
      </ClientProvider>
    </ErrorBoundary>
  );
}
