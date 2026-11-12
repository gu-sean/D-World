// MISSION-01 목표 보드 (목표 탭 첫 화면)
//
// 진행 중인 목표를 카드로 쭉 보여 준다. 각 카드에는 분야, 제목, 남은 기간,
// 진행률 막대가 들어가고, 아직 AI 계획을 받지 않은 목표에는 계획 만들기 버튼이 붙는다.
//
// 목표가 하나도 없으면 바로 만들러 갈 수 있는 안내를 보여 준다.
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { format, useGoals } from '../../client';
import {
  Button,
  Card,
  CategoryChip,
  EmptyState,
  ProgressBar,
  QueryState,
  Screen,
  StatusTag,
} from '../../components';
import Routes from '../../navigation/routes';
import { categoryStyle, colors, spacing, typography } from '../../theme';

export default function GoalBoardScreen({ navigation }) {
  const goals = useGoals({ status: 'active' });

  return (
    <Screen
      title="내 목표"
      padded={false}
      right={
        <Button
          title="새 목표"
          size="sm"
          icon="plus"
          onPress={() => navigation.navigate(Routes.GOAL_FORM)}
        />
      }>
      <QueryState
        query={goals}
        data={goals.items}
        isEmpty={goals.items.length === 0}
        emptyTitle="아직 목표가 없어요"
        emptyText="이루고 싶은 것을 적으면 AI가 단계별 계획을 만들어 드려요.">
        {(items) => (
          <FlatList
            data={items}
            keyExtractor={(goal) => goal.id}
            contentContainerStyle={styles.list}
            onEndReached={() => goals.hasNextPage && goals.fetchNextPage()}
            onEndReachedThreshold={0.4}
            refreshing={goals.isFetching}
            onRefresh={goals.refetch}
            ListFooterComponent={
              <Button
                title="전체 목표 보기"
                variant="text"
                onPress={() => navigation.navigate(Routes.GOAL_LIST)}
              />
            }
            ListEmptyComponent={<EmptyState title="진행 중인 목표가 없어요" />}
            renderItem={({ item }) => (
              <Card
                onPress={() => navigation.navigate(Routes.GOAL_DETAIL, { goalId: item.id })}
                style={styles.card}>
                <View style={styles.topRow}>
                  <CategoryChip categoryCode={item.categoryCode} name={item.categoryName} size="sm" />
                  <StatusTag text={`${Math.round(item.progressRate * 100)}%`} tone="primary" />
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

                {!item.hasAcceptedPlan && (
                  <View style={styles.planButton}>
                    <Button
                      title="AI 계획 만들기"
                      size="sm"
                      variant="secondary"
                      onPress={() =>
                        navigation.navigate(Routes.PLAN_GENERATING, { goalId: item.id })
                      }
                    />
                  </View>
                )}
              </Card>
            )}
          />
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  card: { gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.subtitle, color: colors.text },
  period: { ...typography.caption, color: colors.textSub },
  planButton: { alignSelf: 'flex-start', marginTop: spacing.xs },
});
