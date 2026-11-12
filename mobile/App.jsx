/**
 * 루트 컴포넌트. 앱 전체를 감싸는 세 겹을 쌓는다.
 *
 * ClientProvider    서버 통신·캐시·세션을 준비하고, 저장된 토큰으로 로그인을 되살린다.
 * SafeAreaProvider  노치·홈 인디케이터를 피할 여백 값을 화면들에 내려 준다.
 * RootNavigator     세션 상태에 따라 스플래시 / 로그인 / 메인 탭 중 하나를 띄운다.
 *
 * 상태 바는 밝은 배경에 맞춰 어두운 글씨로 고정한다.
 */
import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ClientProvider } from './src/client';
import RootNavigator from './src/navigation/RootNavigator';
import { colors } from './src/theme';

export default function App() {
  return (
    <ClientProvider>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <RootNavigator />
      </SafeAreaProvider>
    </ClientProvider>
  );
}
