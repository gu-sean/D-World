// MISSION-03 목표 목록
//
// 진행 중·일시정지·완료를 탭으로 걸러 보는 전체 목록이다.
// 목표 보드가 진행 중인 것만 보여 주는 것과 달리, 지난 목표까지 모두 찾을 수 있다.
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { format, labels, useGoals } from '../../client';
import {
  Card,
  CategoryChip,
  OptionRow,
  ProgressBar,
  QueryState,
  Screen,
  StatusTag,
} from '../../components';
import { STATUS_TONE } from '../../components/StatusTag';
import Routes from '../../navigation/routes';
import { categoryStyle, colors, spacing, typography } from '../../theme';

const FILTERS = [
  { value: 'active', label: labels.goalStatus.active },
  { value: 'paused', label: labels.goalStatus.paused },
  { value: 'completed', label: labels.goalStatus.completed },
];

export default function GoalListScreen({ navigation, route }) {
  const [status, setStatus] = useState(route.params?.status ?? 'active');
  const goals = useGoals({ status });

  return (
    <Screen title="전체 목표" onBack={() => navigation.goBack()} padded={false}>
      <View style={styles.filter}>
        <OptionRow options={FILTERS} value={status} onChange={setStatus} />
      </View>

      <QueryState
        query={goals}
        data={goals.items}
        isEmpty={goals.items.length === 0}
        emptyTitle="해당하는 목표가 없어요">
        {(items) => (
          <FlatList
            data={items}
            keyExtractor={(goal) => goal.id}
            contentContainerStyle={styles.list}
            onEndReached={() => goals.hasNextPage && goals.fetchNextPage()}
            onEndReachedThreshold={0.4}
            renderItem={({ item }) => (
              <Card
                onPress={() => navigation.navigate(Routes.GOAL_DETAIL, { goalId: item.id })}
                style={styles.card}>
                <View style={styles.topRow}>
                  <CategoryChip categoryCode={item.categoryCode} name={item.categoryName} size="sm" />
                  <StatusTag text={labels.goalStatus[item.status]} tone={STATUS_TONE[item.status]} />
                </View>
                <Text style={styles.title} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.period}>
                  {format.formatDate(item.startDate)} ~ {format.formatDate(item.endDate)}
                </Text>
                <ProgressBar
                  rate={item.progressRate}
                  color={categoryStyle(item.categoryCode).color}
                />
              </Card>
            )}
          />
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filter: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  card: { gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.subtitle, color: colors.text },
  period: { ...typography.caption, color: colors.textSub },
});
