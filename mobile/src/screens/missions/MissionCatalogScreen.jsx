// MISSION-02 미션 틀 고르기
//
// 공개된 미션 틀을 분야로 걸러 보여 준다. 하나를 고르면 틀의 값을 그대로 복사해
// 그 날짜의 내 미션으로 만든다 — 제목·목표·보상을 따로 적을 필요가 없다.
//
// 어떤 날짜에 넣을지는 앞 화면에서 넘어온 값을 쓰고, 없으면 오늘로 본다.
import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import {
  format,
  useCreateMission,
  useGoalCategories,
  useMissionDefinitions,
} from '../../client';
import {
  Button,
  Card,
  CategoryChip,
  ErrorBanner,
  OptionRow,
  QueryState,
  Screen,
} from '../../components';
import { colors, spacing, typography } from '../../theme';

export default function MissionCatalogScreen({ navigation, route }) {
  const { goalId, date } = route.params ?? {};
  const scheduledDate = date ?? format.todayKst();

  const [categoryCode, setCategoryCode] = useState(null);
  const categories = useGoalCategories();
  const definitions = useMissionDefinitions(categoryCode ? { categoryCode } : {});
  const createMission = useCreateMission();

  const options = useMemo(
    () => [
      { value: null, label: '전체' },
      ...(categories.data ?? []).map((c) => ({ value: c.code, label: c.name })),
    ],
    [categories.data],
  );

  const add = (definition) =>
    createMission.mutate(
      { definitionId: definition.id, scheduledDate, goalId },
      { onSuccess: () => navigation.goBack() },
    );

  return (
    <Screen
      title="미션 고르기"
      subtitle={format.formatDate(scheduledDate)}
      onBack={() => navigation.goBack()}
      padded={false}>
      <View style={styles.filter}>
        <OptionRow options={options} value={categoryCode} onChange={setCategoryCode} />
      </View>

      <ErrorBanner error={createMission.error} />

      <QueryState
        query={definitions}
        data={definitions.items}
        isEmpty={definitions.items.length === 0}
        emptyTitle="고를 수 있는 미션이 없어요">
        {(items) => (
          <FlatList
            data={items}
            keyExtractor={(definition) => definition.id}
            contentContainerStyle={styles.list}
            onEndReached={() => definitions.hasNextPage && definitions.fetchNextPage()}
            onEndReachedThreshold={0.4}
            renderItem={({ item }) => (
              <Card style={styles.card}>
                <CategoryChip categoryCode={item.categoryCode} name={item.categoryName} size="sm" />
                <Text style={styles.title}>{item.title}</Text>
                {!!item.description && <Text style={styles.description}>{item.description}</Text>}
                <Text style={styles.meta}>
                  {format.formatTarget(item.targetValue, item.targetUnit)}
                  {item.estimatedDurationSeconds
                    ? ` · ${format.formatSpokenDuration(item.estimatedDurationSeconds)}`
                    : ''}
                  {item.rewardPreview?.points
                    ? ` · ${format.formatPoints(item.rewardPreview.points)}`
                    : ''}
                </Text>
                <View style={styles.addButton}>
                  <Button
                    title="이 미션 추가"
                    size="sm"
                    onPress={() => add(item)}
                    loading={createMission.isPending}
                  />
                </View>
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
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  card: { gap: spacing.xs },
  title: { ...typography.bodyStrong, color: colors.text },
  description: { ...typography.caption, color: colors.textSub },
  meta: { ...typography.caption, color: colors.textSub },
  addButton: { alignSelf: 'flex-start', marginTop: spacing.xs },
});
