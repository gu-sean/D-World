// MISSION-08 계획 수락 결과
//
// 계획을 수락한 직후에 보인다. 미션이 몇 개 만들어졌는지 알려 주고,
// 오늘 할 미션이 있으면 바로 눌러서 시작할 수 있게 함께 보여 준다.
//
// 값은 앞 화면에서 받은 수락 응답을 그대로 쓴다 — 다시 조회하지 않는다.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Icon, MissionCard, Screen, SectionTitle } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

export default function PlanMissionsScreen({ navigation, route }) {
  const { goalId, createdMissionCount = 0, todayMissions = [] } = route.params ?? {};

  return (
    <Screen title="계획 적용 완료" padded={false}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.hero}>
          <Icon name="check" size={48} color={colors.success} strokeWidth={2.4} />
          <Text style={styles.heading}>미션 {createdMissionCount}개가 만들어졌어요</Text>
          <Text style={styles.description}>
            날짜에 맞춰 하나씩 알려 드릴게요. 오늘 할 것부터 시작해 볼까요?
          </Text>
        </View>

        {todayMissions.length > 0 && (
          <View>
            <SectionTitle title="오늘의 미션" />
            <View style={styles.missions}>
              {todayMissions.map((mission) => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  onPress={() =>
                    navigation.navigate(Routes.MISSION_DETAIL, { missionId: mission.id })
                  }
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="목표 보기"
          variant="secondary"
          onPress={() => navigation.replace(Routes.GOAL_DETAIL, { goalId })}
          full
        />
        <Button title="홈으로" onPress={() => navigation.navigate(Routes.HOME_TAB)} full />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  heading: { ...typography.title, color: colors.text, textAlign: 'center' },
  description: { ...typography.body, color: colors.textSub, textAlign: 'center' },
  missions: { gap: spacing.sm },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
