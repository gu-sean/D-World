// MISSION-01 목표 보드 (목표 탭 첫 화면)
//
// 진행 중인 최종 목표를 카드로 쭉 보여 준다. 각 카드에는 분야, 제목, 기간,
// 진행률 원(가운데 %)이 들어가고, 아직 AI 계획을 받지 않은 목표에는 계획 만들기 버튼이 붙는다.
// 제목 옆 ∨ 를 누르면 그 목표에 묶인 세부 미션이 카드 안에 펼쳐진다.
//
// 목표가 하나도 없으면 바로 만들러 갈 수 있는 안내를 보여 준다.
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { format, useGoals } from '../../client';
import {
  Button,
  Card,
  CategoryChip,
  EmptyState,
  Icon,
  ProgressRing,
  QueryState,
  Screen,
} from '../../components';
import Routes from '../../navigation/routes';
import { categoryStyle, colors, spacing, typography } from '../../theme';
import GoalMissions from './GoalMissions';

export default function GoalBoardScreen({ navigation }) {
  const goals = useGoals({ status: 'active' });
  const [openIds, setOpenIds] = useState(() => new Set());

  const toggle = (goalId) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(goalId)) next.delete(goalId);
      else next.add(goalId);
      return next;
    });

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
            extraData={openIds}
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
            renderItem={({ item }) => {
              const open = openIds.has(item.id);
              return (
                <Card
                  onPress={() => navigation.navigate(Routes.GOAL_DETAIL, { goalId: item.id })}
                  style={styles.card}>
                  <View style={styles.mainRow}>
                    <View style={styles.mainTexts}>
                      <CategoryChip
                        categoryCode={item.categoryCode}
                        name={item.categoryName}
                        size="sm"
                      />
                      <View style={styles.titleRow}>
                        <Text style={styles.title} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <TouchableOpacity
                          onPress={() => toggle(item.id)}
                          hitSlop={10}
                          style={[styles.toggle, open && styles.toggleOpen]}
                          accessibilityRole="button"
                          accessibilityLabel={open ? '세부 미션 접기' : '세부 미션 펼치기'}>
                          <Icon name="chevronDown" size={20} color={colors.textSub} />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.period}>
                        {format.formatDate(item.startDate)} ~ {format.formatDate(item.endDate)}
                      </Text>
                    </View>

                    <ProgressRing
                      rate={item.progressRate}
                      size={60}
                      thickness={6}
                      color={categoryStyle(item.categoryCode).color}
                    />
                  </View>

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

                  {open && (
                    <View style={styles.missionsBox}>
                      <Text style={styles.missionsHeading}>세부 미션</Text>
                      <GoalMissions
                        goalId={item.id}
                        onOpenMission={(missionId) =>
                          navigation.navigate(Routes.MISSION_DETAIL, { missionId })
                        }
                      />
                    </View>
                  )}
                </Card>
              );
            }}
          />
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  card: { gap: spacing.sm },
  mainRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mainTexts: { flex: 1, gap: spacing.xs, alignItems: 'flex-start' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'stretch' },
  title: { ...typography.subtitle, color: colors.text, flexShrink: 1 },
  toggle: { padding: 2, borderRadius: 12 },
  toggleOpen: { transform: [{ rotate: '180deg' }] },
  period: { ...typography.caption, color: colors.textSub },
  planButton: { alignSelf: 'flex-start', marginTop: spacing.xs },
  missionsBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  missionsHeading: { ...typography.caption, color: colors.textSub },
});
