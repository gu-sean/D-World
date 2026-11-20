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
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ClientProvider, useSession } from './src/client';
import permissions from './src/client/device/permissions';
import ConfirmDialog from './src/components/ConfirmDialog';
import ErrorBoundary from './src/components/ErrorBoundary';
import InAppNotice from './src/components/InAppNotice';
import { startSubmissionSync } from './src/client/flows/submissionQueue';
import { afterMissionChanged } from './src/client/queries/invalidate';
import { openLink } from './src/navigation/linking';
import { clearPendingNavigation } from './src/navigation/navigationRef';
import RootNavigator from './src/navigation/RootNavigator';
import {
  onForegroundMessage,
  onNotificationOpened,
  onPushTokenRefresh,
  registerPushDevice,
  requestNotificationPermission,
} from './src/setup/pushRegistration';
import { colors } from './src/theme';

/** 비동기로 받는 구독 해제 함수를 effect 정리 때 안전하게 부른다. */
function subscribe(promise) {
  let off = () => {};
  let active = true;
  promise.then((unsubscribe) => {
    if (active) off = unsubscribe;
    else unsubscribe();
  });
  return () => {
    active = false;
    off();
  };
}

/**
 * 로그인된 동안 푸시를 다룬다.
 *  - 앱을 켤 때마다(로그인 상태가 될 때마다) 휴대폰 알림 권한을 묻는다. 허용돼 있으면 묻지 않는다.
 *    Android가 더 묻지 못하게 막았으면(두 번 거절) 설정 화면으로 안내하는 창을 띄우고,
 *    설정에서 돌아오면 바로 토큰을 등록한다.
 *  - 기기의 푸시 토큰을 서버에 등록하고, FCM이 토큰을 바꾸면 다시 등록한다
 *    (등록 해제는 로그아웃 직전에 `useLogout`이 한다).
 *  - 알림을 눌러 앱이 열리면 알림의 `linkScreen`이 가리키는 화면으로 보낸다.
 *  - 앱을 보는 중에 온 푸시는 위쪽 띠(`InAppNotice`)로 보여 주고, 알림함 목록을 새로 읽는다.
 */
function PushHandler() {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState(null);
  const [askSettings, setAskSettings] = useState(false);
  // 설정 화면에 다녀오는 중이면, 앱으로 돌아왔을 때 다시 등록한다
  const fromSettings = useRef(false);

  useEffect(() => {
    if (status !== 'signedIn') {
      if (status === 'signedOut') clearPendingNavigation();
      setNotice(null);
      setAskSettings(false);
      return undefined;
    }
    let active = true;
    requestNotificationPermission().then((permission) => {
      if (!active) return;
      if (permission === 'blocked') setAskSettings(true);
      registerPushDevice();
    });
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active' && fromSettings.current) {
        fromSettings.current = false;
        registerPushDevice();
      }
    });
    const offTokenRefresh = subscribe(onPushTokenRefresh());
    const offOpened = subscribe(onNotificationOpened((linkScreen) => openLink(linkScreen)));
    const offForeground = subscribe(
      onForegroundMessage((message) => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        if (message.title || message.body) setNotice({ ...message, id: Date.now() });
      }),
    );
    // 신호가 약해 못 올린 인증 영상을 이어서 올린다 (화면에는 아무것도 더하지 않는다)
    const stopSync = startSubmissionSync({
      onSubmitted: () => afterMissionChanged(queryClient),
      onDropped: (body) => setNotice({ title: '인증 영상을 올리지 못했어요', body, id: Date.now() }),
    });
    return () => {
      active = false;
      appState.remove();
      offTokenRefresh();
      offOpened();
      offForeground();
      stopSync();
    };
  }, [status, queryClient]);

  const close = useCallback(() => setNotice(null), []);
  const open = useCallback(() => {
    const linkScreen = notice?.linkScreen;
    setNotice(null);
    openLink(linkScreen);
  }, [notice]);

  const openSettings = useCallback(() => {
    setAskSettings(false);
    fromSettings.current = true;
    permissions.openSettings();
  }, []);
  const laterSettings = useCallback(() => setAskSettings(false), []);

  return (
    <>
      <InAppNotice notice={notice} onPress={open} onClose={close} />
      <ConfirmDialog
        visible={askSettings}
        title="알림이 꺼져 있어요"
        message="인증이 승인·반려됐을 때 휴대폰 알림으로 받으려면 설정에서 D-World 알림을 켜 주세요."
        confirmText="설정 열기"
        cancelText="나중에"
        onConfirm={openSettings}
        onCancel={laterSettings}
      />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ClientProvider>
        <SafeAreaProvider>
          <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
          <RootNavigator />
          <PushHandler />
        </SafeAreaProvider>
      </ClientProvider>
    </ErrorBoundary>
  );
}
