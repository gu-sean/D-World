// CHALLENGE-01 챌린지 둘러보기
//
// 모집 중·진행 중·끝난 챌린지를 탭으로 나눠 보여 준다. 모집 중 탭에서는
// 곧 시작하는 챌린지만 따로 모아 볼 수 있다 (`isClosingSoon`).
//
// 정원이 있는 챌린지는 남은 자리를, 이미 참여 중인 챌린지는 그 사실을 카드에서
// 바로 알 수 있게 한다.
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { format, labels, useChallenges, useGoalCategories } from '../../client';
import {
  Button,
  Card,
  CategoryChip,
  OptionRow,
  QueryState,
  Screen,
  StatusTag,
} from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const PHASES = [
  { value: 'recruiting', label: '모집 중' },
  { value: 'ongoing', label: '진행 중' },
  { value: 'ended', label: '끝남' },
];

export default function ChallengeExploreScreen({ navigation }) {
  const [phase, setPhase] = useState('recruiting');
  const [categoryCode, setCategoryCode] = useState(null);
  const [closingSoon, setClosingSoon] = useState(false);

  const categories = useGoalCategories();
  const challenges = useChallenges({
    phase,
    categoryCode: categoryCode ?? undefined,
    closingSoon: phase === 'recruiting' && closingSoon ? true : undefined,
  });

  const categoryOptions = [
    { value: 'all', label: '전체' },
    ...(categories.data ?? []).map((c) => ({ value: c.code, label: c.name })),
  ];

  return (
    <Screen
      title="챌린지"
      onBack={() => navigation.goBack()}
      padded={false}
      right={
        <Button
          title="만들기"
          size="sm"
          icon="plus"
          onPress={() => navigation.navigate(Routes.CHALLENGE_CREATE)}
        />
      }>
      <View style={styles.filters}>
        <OptionRow options={PHASES} value={phase} onChange={setPhase} />
        <OptionRow
          options={categoryOptions}
          value={categoryCode ?? 'all'}
          onChange={(value) => setCategoryCode(value === 'all' ? null : value)}
        />
        {phase === 'recruiting' && (
          <Button
            title={closingSoon ? '곧 시작하는 것만 ✓' : '곧 시작하는 것만'}
            variant={closingSoon ? 'primary' : 'secondary'}
            size="sm"
            onPress={() => setClosingSoon((prev) => !prev)}
          />
        )}
      </View>

      <QueryState
        query={challenges}
        data={challenges.items}
        isEmpty={challenges.items.length === 0}
        emptyTitle="해당하는 챌린지가 없어요"
        emptyText="조건을 바꿔 보거나 직접 챌린지를 만들어 보세요.">
        {(list) => (
          <FlatList
            data={list}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshing={challenges.isFetching && !challenges.isFetchingNextPage}
            onRefresh={challenges.refetch}
            onEndReached={() => challenges.hasNextPage && challenges.fetchNextPage()}
            onEndReachedThreshold={0.4}
            renderItem={({ item }) => {
              const seatsLeft =
                item.maxParticipants != null
                  ? Math.max(item.maxParticipants - item.participantCount, 0)
                  : null;

              return (
                <Card
                  onPress={() =>
                    navigation.navigate(Routes.CHALLENGE_DETAIL, { challengeId: item.id })
                  }
                  style={styles.card}>
                  <View style={styles.topRow}>
                    <CategoryChip categoryCode={item.categoryCode} size="sm" />
                    {item.isClosingSoon && <StatusTag text="곧 시작" tone="warning" />}
                    {!!item.myParticipation && (
                      <StatusTag
                        text={labels.challengeParticipationStatus[item.myParticipation.status]}
                        tone="primary"
                      />
                    )}
                  </View>

                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.description} numberOfLines={2}>
                    {item.description}
                  </Text>

                  <View style={styles.metaRow}>
                    <Text style={styles.meta}>
                      {format.formatDate(item.startDate)} 시작 · {item.periodDays}일
                    </Text>
                    <Text style={styles.meta}>
                      {item.participantCount}명 참여
                      {seatsLeft != null ? ` · ${seatsLeft}자리 남음` : ''}
                    </Text>
                  </View>

                  <Text style={styles.reward}>
                    완주 보상 {format.formatPoints(item.reward?.points ?? 0)}
                  </Text>
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
  filters: { padding: spacing.lg, paddingBottom: 0, gap: spacing.sm, alignItems: 'flex-start' },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  card: { gap: spacing.xs },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  title: { ...typography.bodyStrong, color: colors.text },
  description: { ...typography.caption, color: colors.textSub },
  metaRow: { gap: 2, marginTop: spacing.xs },
  meta: { ...typography.caption, color: colors.textSub },
  reward: { ...typography.caption, color: colors.primary },
});
