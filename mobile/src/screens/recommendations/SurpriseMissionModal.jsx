// SITUATION-08 깜짝 미션
//
// 홈 위에 떠서 지금 하기 좋은 미션 하나를 권한다. 아직 살아 있는 추천 중
// 1순위만 보여 주고 "담기" · "자세히" · "다음에"만 고르게 한다.
//
// 담으면 서버가 오늘 미션을 만들어 주므로 그 미션 상세로 바로 넘어간다.
// 살아 있는 추천이 없으면 띄울 것이 없어 스스로 닫는다.
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  format,
  labels,
  useAcceptRecommendation,
  useActiveRecommendations,
} from '../../client';
import { Button, ErrorBanner, Icon } from '../../components';
import Routes from '../../navigation/routes';
import { colors, radius, spacing, typography } from '../../theme';

export default function SurpriseMissionModal({ navigation }) {
  const active = useActiveRecommendations();
  const accept = useAcceptRecommendation();

  const top =
    (active.data ?? [])
      .filter((item) => item.status === 'shown')
      .sort((a, b) => a.rankNo - b.rankNo)[0] ?? null;

  const empty = !active.isLoading && !top;

  useEffect(() => {
    if (empty) navigation.goBack();
  }, [empty, navigation]);

  if (!top) return <View style={styles.backdrop} />;

  const take = () =>
    accept.mutate(
      { recommendationId: top.id },
      {
        onSuccess: (mission) => {
          if (mission?.id) {
            navigation.replace(Routes.MISSION_DETAIL, { missionId: mission.id });
          } else {
            navigation.goBack();
          }
        },
      },
    );

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <ErrorBanner error={accept.error} />

        <View style={styles.badge}>
          <Icon name="gift" size={18} color={colors.primary} />
          <Text style={styles.badgeText}>깜짝 미션</Text>
        </View>

        <Text style={styles.title}>{top.title}</Text>
        <Text style={styles.reason}>{top.reason}</Text>

        {!!top.context && (
          <Text style={styles.context}>
            {labels.timeSlot[top.context.timeSlot]} · {labels.weatherCode[top.context.weather]}
          </Text>
        )}

        {!!top.rewardPreview && (
          <Text style={styles.reward}>
            성공하면 {format.formatPoints(top.rewardPreview.points)}
          </Text>
        )}

        {!!top.expiresAt && (
          <Text style={styles.expires}>{format.formatRelative(top.expiresAt)}까지</Text>
        )}

        <View style={styles.actions}>
          <Button title="담기" onPress={take} loading={accept.isPending} full />
          <Button
            title="자세히 보기"
            variant="secondary"
            onPress={() =>
              navigation.replace(Routes.RECOMMENDATION_DETAIL, { recommendationId: top.id })
            }
            full
          />
          <Button title="다음에" variant="text" onPress={() => navigation.goBack()} full />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 20, 28, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.xs,
  },
  badge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  badgeText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  title: { ...typography.title, color: colors.text },
  reason: { ...typography.body, color: colors.textSub },
  context: { ...typography.caption, color: colors.textSub },
  reward: { ...typography.caption, color: colors.primary },
  expires: { ...typography.caption, color: colors.textSub },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
