// MY-10 설정
//
// 알림 켜기·끄기, 상황 추천 설정, 권한 상태, 로그아웃, 탈퇴를 모아 둔다.
// 알림 설정만 서버에 저장되고(`notificationEnabled`), 나머지는 다른 화면으로 가는 길이다.
//
// 로그아웃과 탈퇴는 되돌리기 어려우므로 로그아웃은 한 번 더 묻고, 탈퇴는
// 안내가 긴 별도 화면으로 보낸다.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { config, useLogout, useMe, useUpdateProfile } from '../../client';
import {
  Card,
  ConfirmDialog,
  ErrorBanner,
  ListRow,
  QueryState,
  Screen,
  SectionTitle,
} from '../../components';
import Routes from '../../navigation/routes';
import { colors, radius, spacing, typography } from '../../theme';

export default function SettingsScreen({ navigation }) {
  const [askLogout, setAskLogout] = useState(false);

  const me = useMe();
  const updateProfile = useUpdateProfile();
  const logout = useLogout();

  return (
    <Screen title="설정" onBack={() => navigation.goBack()} padded={false}>
      <ErrorBanner error={updateProfile.error ?? logout.error} />

      <QueryState query={me}>
        {(data) => (
          <ScrollView contentContainerStyle={styles.body}>
            <SectionTitle title="알림" />
            <View style={styles.group}>
              <ListRow
                icon="bell"
                title="알림 받기"
                description="인증 결과·보상·추천을 알려 줘요"
                right={
                  <Switch
                    value={!!data.notificationEnabled}
                    onValueChange={(notificationEnabled) =>
                      updateProfile.mutate({ notificationEnabled })
                    }
                    disabled={updateProfile.isPending}
                  />
                }
              />
            </View>

            <SectionTitle title="추천과 권한" />
            <View style={styles.group}>
              <ListRow
                icon="search"
                title="상황 추천"
                description="날씨·시간에 맞는 미션 추천"
                onPress={() => navigation.navigate(Routes.CONTEXT_SETTINGS)}
              />
              <ListRow
                icon="pin"
                title="권한 상태"
                description="위치·활동·알림 권한 확인"
                onPress={() => navigation.navigate(Routes.LOCATION_STATUS)}
              />
            </View>

            <SectionTitle title="안내" />
            <View style={styles.group}>
              <ListRow
                icon="book"
                title="공지사항"
                onPress={() => navigation.navigate(Routes.NOTICE_LIST)}
              />
              <ListRow
                icon="star"
                title="구독"
                onPress={() => navigation.navigate(Routes.SUBSCRIPTION)}
              />
              <ListRow icon="gear" title="앱 버전" value={config.APP_VERSION} />
            </View>

            <SectionTitle title="계정" />
            <View style={styles.group}>
              <ListRow icon="logout" title="로그아웃" onPress={() => setAskLogout(true)} />
              <ListRow
                title="회원 탈퇴"
                danger
                onPress={() => navigation.navigate(Routes.WITHDRAWAL)}
              />
            </View>

            <Card style={styles.noteCard}>
              <Text style={styles.note}>
                로그아웃해도 기록은 그대로 남아 있어요. 같은 계정으로 다시 로그인하면
                이어서 할 수 있어요.
              </Text>
            </Card>
          </ScrollView>
        )}
      </QueryState>

      <ConfirmDialog
        visible={askLogout}
        title="로그아웃할까요?"
        message="다음에 다시 로그인하면 이어서 할 수 있어요."
        confirmText="로그아웃"
        loading={logout.isPending}
        onConfirm={() => logout.mutate({})}
        onCancel={() => setAskLogout(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  group: { backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden' },
  noteCard: { marginTop: spacing.md },
  note: { ...typography.caption, color: colors.textSub },
});
