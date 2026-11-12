// SITUATION-01 상황 추천 설정
//
// 상황 추천이 무엇을 보고 미션을 골라 주는지 설명하고, 위치·활동 권한과
// 추천 알림을 한 자리에서 켜고 끌 수 있게 한다.
//
// 권한은 앱이 가진 값이 아니라 기기 설정이므로 화면에 들어올 때마다 다시 확인하고,
// 알림 켜기/끄기만 서버 프로필(`notificationEnabled`)에 저장한다.
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { permissions, useMe, useUpdateProfile } from '../../client';
import { Card, ErrorBanner, Icon, ListRow, QueryState, Screen } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const SIGNALS = [
  { icon: 'pin', text: '지금 있는 곳의 날씨와 기온' },
  { icon: 'clock', text: '아침·낮·저녁·밤 중 어느 때인지' },
  { icon: 'run', text: '걷거나 움직이고 있는지' },
];

const PERMISSION_TEXT = {
  granted: '허용됨',
  denied: '꺼져 있음',
  blocked: '설정에서 막힘',
  unavailable: '이 기기에 없음',
};

export default function ContextSettingsScreen({ navigation }) {
  const [status, setStatus] = useState({ location: null, activity: null });

  const me = useMe();
  const updateProfile = useUpdateProfile();

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      Promise.all([permissions.check('location'), permissions.check('activity')]).then(
        ([location, activity]) => {
          if (alive) setStatus({ location, activity });
        },
      );
      return () => {
        alive = false;
      };
    }, []),
  );

  return (
    <Screen title="상황 추천" onBack={() => navigation.goBack()} padded={false}>
      <ErrorBanner error={updateProfile.error} />

      <QueryState query={me}>
        {(data) => (
          <ScrollView contentContainerStyle={styles.body}>
            <Card style={styles.intro}>
              <Text style={styles.introTitle}>지금 하기 좋은 미션을 골라 줘요</Text>
              {SIGNALS.map((signal) => (
                <View key={signal.text} style={styles.signalRow}>
                  <Icon name={signal.icon} size={18} color={colors.primary} />
                  <Text style={styles.signalText}>{signal.text}</Text>
                </View>
              ))}
              <Text style={styles.privacy}>
                위치는 추천을 받을 때 한 번만 쓰고 저장하지 않아요.
              </Text>
            </Card>

            <View style={styles.group}>
              <ListRow
                icon="pin"
                title="위치 권한"
                description="날씨에 맞는 미션을 받을 때 써요"
                value={PERMISSION_TEXT[status.location] ?? '확인 중'}
                onPress={() =>
                  navigation.navigate(Routes.LOCATION_PERMISSION, { next: 'weather' })
                }
              />
              <ListRow
                icon="run"
                title="활동 권한"
                description="움직이는 중일 때 가벼운 미션을 권해요"
                value={PERMISSION_TEXT[status.activity] ?? '확인 중'}
                onPress={() => navigation.navigate(Routes.LOCATION_STATUS)}
              />
              <ListRow
                icon="bell"
                title="추천 알림"
                description="상황에 맞는 미션이 생기면 알려 줘요"
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

            <View style={styles.group}>
              <ListRow
                icon="search"
                title="지금 추천받기"
                description="날씨와 시간을 보고 미션을 골라 줘요"
                onPress={() =>
                  navigation.navigate(Routes.SITUATION_RECOMMEND, { kind: 'weather' })
                }
              />
            </View>
          </ScrollView>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  intro: { gap: spacing.sm },
  introTitle: { ...typography.subtitle, color: colors.text },
  signalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  signalText: { ...typography.body, color: colors.text, flex: 1 },
  privacy: { ...typography.caption, color: colors.textSub, marginTop: spacing.xs },
  group: { backgroundColor: colors.surface, borderRadius: spacing.md, overflow: 'hidden' },
});
