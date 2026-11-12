// BALANCE-09 재조정 기록
//
// 그동안 받은 재조정 제안을 최근 순으로 보여 준다. 적용·거절·만료가 섞여 있으므로
// 상태를 태그로 구분하고, 아직 정하지 않은 제안은 위에서 바로 이어서 볼 수 있게 한다.
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { format, labels, usePlanAdjustments } from '../../client';
import { Card, QueryState, Screen, StatusTag } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const TONE = {
  proposed: 'primary',
  accepted: 'success',
  rejected: 'neutral',
  expired: 'neutral',
};

export default function PlanAdjustHistoryScreen({ navigation }) {
  const adjustments = usePlanAdjustments();

  const open = (item) => {
    if (item.status === 'proposed') {
      navigation.navigate(Routes.PLAN_ADJUST_REASON, { adjustmentId: item.id });
    } else {
      navigation.navigate(Routes.PLAN_ADJUST_HISTORY_DETAIL, { adjustmentId: item.id });
    }
  };

  return (
    <Screen title="계획 조정 기록" onBack={() => navigation.goBack()} padded={false}>
      <QueryState
        query={adjustments}
        data={adjustments.items}
        isEmpty={adjustments.items.length === 0}
        emptyTitle="아직 조정 기록이 없어요"
        emptyText="미션을 쌓다 보면 AI가 더 맞는 계획을 제안해 줘요.">
        {(list) => (
          <FlatList
            data={list}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshing={adjustments.isFetching && !adjustments.isFetchingNextPage}
            onRefresh={adjustments.refetch}
            onEndReached={() => adjustments.hasNextPage && adjustments.fetchNextPage()}
            onEndReachedThreshold={0.4}
            renderItem={({ item }) => (
              <Card onPress={() => open(item)} style={styles.card}>
                <View style={styles.topRow}>
                  <Text style={styles.goal} numberOfLines={1}>
                    {item.goalTitle}
                  </Text>
                  <StatusTag
                    text={labels.planAdjustmentStatus[item.status]}
                    tone={TONE[item.status] ?? 'neutral'}
                  />
                </View>

                <Text style={styles.reason} numberOfLines={2}>
                  {item.reason}
                </Text>

                <Text style={styles.meta}>
                  {format.formatDate(item.createdAt)}
                  {item.decidedAt ? ` · ${format.formatDate(item.decidedAt)} 처리` : ''}
                </Text>
              </Card>
            )}
          />
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  card: { gap: spacing.xs },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  goal: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  reason: { ...typography.body, color: colors.textSub },
  meta: { ...typography.caption, color: colors.textSub },
});
