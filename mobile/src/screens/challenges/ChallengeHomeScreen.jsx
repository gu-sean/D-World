// CHALLENGE-00 챌린지 탭 첫 화면
//
// 관리자가 만든 챌린지(origin=admin) 중 모집 중·진행 중인 것만 보여 준다.
// 하나도 없으면 "다음 챌린지를 기대해 주세요." 안내를 띄운다.
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { format, labels, useChallenges } from '../../client';
import { Button, Card, CategoryChip, QueryState, Screen, StatusTag } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const PHASE_LABEL = { recruiting: '모집 중', ongoing: '진행 중' };

export default function ChallengeHomeScreen({ navigation }) {
  const recruiting = useChallenges({ origin: 'admin', phase: 'recruiting' });
  const ongoing = useChallenges({ origin: 'admin', phase: 'ongoing' });

  const items = [
    ...recruiting.items.map((item) => ({ ...item, phase: 'recruiting' })),
    ...ongoing.items.map((item) => ({ ...item, phase: 'ongoing' })),
  ];
  const query = {
    isLoading: recruiting.isLoading || ongoing.isLoading,
    isError: recruiting.isError && ongoing.isError,
    error: recruiting.error ?? ongoing.error,
    refetch: () => {
      recruiting.refetch();
      ongoing.refetch();
    },
  };

  return (
    <Screen
      title="챌린지"
      padded={false}
      right={
        <Button
          title="내 챌린지"
          size="sm"
          variant="secondary"
          onPress={() => navigation.navigate(Routes.MY_CHALLENGES)}
        />
      }>
      <QueryState
        query={query}
        data={items}
        isEmpty={items.length === 0}
        emptyTitle="다음 챌린지를 기대해 주세요."
        emptyText="새 챌린지가 열리면 여기에서 바로 참여할 수 있어요.">
        {(list) => (
          <FlatList
            data={list}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshing={recruiting.isFetching || ongoing.isFetching}
            onRefresh={query.refetch}
            onEndReached={() => {
              if (recruiting.hasNextPage) recruiting.fetchNextPage();
              else if (ongoing.hasNextPage) ongoing.fetchNextPage();
            }}
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
                    <StatusTag
                      text={PHASE_LABEL[item.phase]}
                      tone={item.phase === 'ongoing' ? 'success' : 'primary'}
                    />
                    {item.isClosingSoon && <StatusTag text="곧 시작" tone="warning" />}
                    {!!item.myParticipation && (
                      <StatusTag
                        text={labels.challengeParticipationStatus[item.myParticipation.status]}
                        tone="primary"
                      />
                    )}
                  </View>

                  <Text style={styles.title} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {!!item.description && (
                    <Text style={styles.description} numberOfLines={2}>
                      {item.description}
                    </Text>
                  )}

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
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  card: { gap: spacing.xs },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  title: { ...typography.bodyStrong, color: colors.text },
  description: { ...typography.caption, color: colors.textSub },
  metaRow: { gap: 2, marginTop: spacing.xs },
  meta: { ...typography.caption, color: colors.textSub },
  reward: { ...typography.caption, color: colors.primary },
});
