// MISSION-13 미션 완료 · 보상
//
// 인증이 승인된 뒤 보여 주는 축하 화면이다. 서버가 실제로 지급한 보상만 그린다 —
// 포인트가 월 한도로 깎였는지, 레벨이 올랐는지, 펫이 진화했는지도 서버 응답 그대로다.
//
// 이번에 새 업적을 얻었으면 업적 모달을, 펫이 진화했으면 진화 모달을 이어서 띄운다.
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useRecord } from '../../client';
import { Button, Icon, QueryState, RewardSummary, Screen } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

export default function MissionCompleteScreen({ navigation, route }) {
  const { recordId } = route.params ?? {};
  const record = useRecord(recordId);

  const rewards = record.data?.rewards;
  const newBadges = rewards?.newBadges ?? [];

  // 새 업적이 있으면 축하 모달을 한 번 띄운다.
  useEffect(() => {
    if (newBadges.length > 0) {
      navigation.navigate(Routes.ACHIEVEMENT_EARNED_MODAL, { badges: newBadges });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newBadges.length]);

  return (
    <Screen padded={false}>
      <QueryState query={record}>
        {(data) => (
          <>
            <ScrollView contentContainerStyle={styles.body}>
              <View style={styles.hero}>
                <Icon name="trophy" size={56} color={colors.warning} />
                <Text style={styles.heading}>미션을 해냈어요</Text>
                <Text style={styles.description}>
                  오늘의 기록이 남았어요. 이 기세로 하나 더 해볼까요?
                </Text>
              </View>

              <RewardSummary rewards={data.rewards} />

              {data.rewards?.petEvolved && !!data.rewards?.petId && (
                <Button
                  title="펫 진화 보기"
                  variant="secondary"
                  onPress={() =>
                    navigation.navigate(Routes.PET_EVOLUTION_MODAL, { petId: data.rewards.petId })
                  }
                  full
                />
              )}
            </ScrollView>

            <View style={styles.footer}>
              <Button
                title="다음 미션 추천 받기"
                onPress={() => navigation.replace(Routes.NEXT_MISSION)}
                full
              />
              <Button
                title="홈으로"
                variant="secondary"
                onPress={() => navigation.navigate(Routes.HOME_TAB)}
                full
              />
            </View>
          </>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  heading: { ...typography.title, color: colors.text },
  description: { ...typography.body, color: colors.textSub, textAlign: 'center' },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
