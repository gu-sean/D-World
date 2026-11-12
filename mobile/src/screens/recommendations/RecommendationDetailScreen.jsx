// SITUATION-07 추천 미션 상세
//
// 추천 하나를 자세히 보여 주고 오늘 미션으로 담을지 정한다. 수락하면 서버가
// 오늘 날짜로 미션을 만들어 주므로 바로 그 미션 상세로 넘어간다.
//
// 추천은 만든 지 3시간이 지나면 만료되므로 남은 시간을 함께 알려 준다.
// 목록 화면에서 받은 추천은 아직 살아 있는 추천 목록에 들어 있어 거기서 찾아 쓴다.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  format,
  labels,
  useAcceptRecommendation,
  useActiveRecommendations,
} from '../../client';
import {
  Button,
  Card,
  CategoryChip,
  ErrorBanner,
  Icon,
  QueryState,
  Screen,
} from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

export default function RecommendationDetailScreen({ navigation, route }) {
  const { recommendationId } = route.params ?? {};
  const [accepted, setAccepted] = useState(false);

  const active = useActiveRecommendations();
  const accept = useAcceptRecommendation();

  const take = (item) =>
    accept.mutate(
      { recommendationId },
      {
        onSuccess: (mission) => {
          setAccepted(true);
          if (mission?.id) {
            navigation.replace(Routes.MISSION_DETAIL, { missionId: mission.id });
          } else {
            navigation.goBack();
          }
        },
        onError: () => setAccepted(false),
      },
    );

  const found = (active.data ?? []).find((item) => item.id === recommendationId) ?? null;

  return (
    <Screen title="추천 미션" onBack={() => navigation.goBack()} padded={false}>
      <ErrorBanner error={accept.error} />

      <QueryState
        query={active}
        data={found}
        isEmpty={!found}
        emptyTitle="이 추천은 이미 끝났어요"
        emptyText="추천은 받은 뒤 3시간 동안만 담을 수 있어요. 다시 받아 보세요.">
        {(item) => {
          const definition = item.missionDefinition;

          return (
            <>
              <ScrollView contentContainerStyle={styles.body}>
                <View style={styles.head}>
                  <Text style={styles.rank}>{item.rankNo}순위 추천</Text>
                  <Text style={styles.title}>{item.title}</Text>
                  {!!definition?.categoryName && (
                    <CategoryChip
                      categoryCode={definition.categoryCode}
                      name={definition.categoryName}
                    />
                  )}
                </View>

                <Card style={styles.reasonCard}>
                  <Text style={styles.reasonLabel}>왜 이 미션인가요</Text>
                  <Text style={styles.reason}>{item.reason}</Text>
                </Card>

                {!!item.context && (
                  <Card style={styles.contextCard}>
                    <Text style={styles.reasonLabel}>지금 상황</Text>
                    <View style={styles.contextRow}>
                      <Icon name="clock" size={16} color={colors.textSub} />
                      <Text style={styles.contextText}>
                        {labels.timeSlot[item.context.timeSlot]}
                      </Text>
                    </View>
                    <View style={styles.contextRow}>
                      <Icon name="pin" size={16} color={colors.textSub} />
                      <Text style={styles.contextText}>
                        {labels.weatherCode[item.context.weather]}
                        {typeof item.context.temperatureC === 'number'
                          ? ` · ${item.context.temperatureC}°C`
                          : ''}
                      </Text>
                    </View>
                    <Text style={styles.suitable}>
                      {item.context.outdoorSuitable
                        ? '바깥에서 하기 좋은 날이에요.'
                        : '실내에서 하기 좋은 날이에요.'}
                    </Text>
                  </Card>
                )}

                {!!definition && (
                  <Card style={styles.definitionCard}>
                    <Text style={styles.reasonLabel}>미션 내용</Text>
                    <Text style={styles.definitionTitle}>{definition.title}</Text>
                    {!!definition.description && (
                      <Text style={styles.definitionText}>{definition.description}</Text>
                    )}
                    <Text style={styles.definitionText}>
                      {format.formatTarget(definition.targetValue, definition.targetUnit)}
                    </Text>
                  </Card>
                )}

                {!!item.rewardPreview && (
                  <Card style={styles.rewardCard}>
                    <Text style={styles.reasonLabel}>성공하면</Text>
                    <Text style={styles.rewardText}>
                      {format.formatPoints(item.rewardPreview.points)}
                      {item.rewardPreview.userXp ? ` · 경험치 ${item.rewardPreview.userXp}` : ''}
                      {item.rewardPreview.petXp ? ` · 펫 경험치 ${item.rewardPreview.petXp}` : ''}
                    </Text>
                  </Card>
                )}

                {!!item.expiresAt && (
                  <Text style={styles.expires}>
                    {format.formatRelative(item.expiresAt)}까지 담을 수 있어요.
                  </Text>
                )}
              </ScrollView>

              <View style={styles.footer}>
                <Button
                  title="오늘 미션으로 담기"
                  onPress={() => take(item)}
                  loading={accept.isPending || accepted}
                  full
                />
                <Button
                  title="이 추천은 별로예요"
                  variant="text"
                  onPress={() =>
                    navigation.navigate(Routes.RECOMMENDATION_FEEDBACK, { recommendationId })
                  }
                  full
                />
              </View>
            </>
          );
        }}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  head: { gap: spacing.xs, alignItems: 'flex-start' },
  rank: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  title: { ...typography.title, color: colors.text },
  reasonCard: { gap: spacing.xs },
  reasonLabel: { ...typography.caption, color: colors.textSub },
  reason: { ...typography.body, color: colors.text },
  contextCard: { gap: spacing.xs },
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  contextText: { ...typography.body, color: colors.text },
  suitable: { ...typography.caption, color: colors.textSub, marginTop: spacing.xs },
  definitionCard: { gap: spacing.xs },
  definitionTitle: { ...typography.bodyStrong, color: colors.text },
  definitionText: { ...typography.caption, color: colors.textSub },
  rewardCard: { gap: spacing.xs },
  rewardText: { ...typography.body, color: colors.text },
  expires: { ...typography.caption, color: colors.textSub, textAlign: 'center' },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
