// CHALLENGE-00 챌린지 탭 첫 화면
//
// 관리자가 만든 챌린지(origin=admin) 중 모집 중·진행 중인 것만 보여 준다.
// 하나도 없으면 "다음 챌린지를 기대해 주세요." 안내를 띄운다.
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { format, labels, useChallenges } from '../../client';
import { Button, Card, CategoryChip, QueryState, Screen, StatusTag } from '../../components';
import Routes from '../../navigation/routes';
import { colors, radius, spacing, typography } from '../../theme';

const PHASE_LABEL = { recruiting: '모집 중', ongoing: '진행 중' };

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (date) => Math.floor(Date.parse(`${String(date).slice(0, 10)}T00:00:00Z`) / DAY_MS);

/**
 * 카드의 상태 칩 문구. 모집 중이면 곧 시작할 때만 '내일 시작'처럼 덧붙이고,
 * 진행 중이면 '3일째 · 4일 남음'처럼 보여 준다.
 */
function statusText(item) {
  const today = dayNumber(format.todayKst());
  if (item.phase === 'ongoing') {
    const day = today - dayNumber(item.startDate) + 1;
    const left = Math.max(item.periodDays - day, 0);
    if (day >= 1 && day <= item.periodDays) {
      return left > 0 ? `${day}일째 · ${left}일 남음` : `${day}일째 · 마지막 날`;
    }
    return PHASE_LABEL.ongoing;
  }
  const until = dayNumber(item.startDate) - today;
  if (item.isClosingSoon && until >= 0) {
    const when = until === 0 ? '오늘 시작' : until === 1 ? '내일 시작' : `${until}일 뒤 시작`;
    return `${PHASE_LABEL.recruiting} · ${when}`;
  }
  return PHASE_LABEL.recruiting;
}

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
          variant="text"
          icon="trophy"
          onPress={() => navigation.navigate(Routes.MY_CHALLENGES)}
        />
      }>
      <QueryState skeleton="card"
        query={query}
        data={items}
        isEmpty={items.length === 0}
        emptyTitle="다음 챌린지를 기대해 주세요."
        emptyText="새 챌린지가 열리면 여기에서 바로 참여할 수 있어요."
        emptyIcon="trophy">
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
                  accessibilityLabel={`${item.title}, ${statusText(item)}, 완주 보상 ${format.formatPoints(item.reward?.points ?? 0)}`}
                  style={styles.card}>
                  <View style={styles.topRow}>
                    <CategoryChip categoryCode={item.categoryCode} size="sm" />
                    <StatusTag
                      text={statusText(item)}
                      tone={
                        item.phase === 'ongoing' ? 'success' : item.isClosingSoon ? 'warning' : 'primary'
                      }
                    />
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
                    <Text style={styles.description} numberOfLines={1}>
                      {item.description}
                    </Text>
                  )}

                  <View style={styles.footer}>
                    <View style={styles.footerLeft}>
                      <Text style={styles.meta}>
                        {format.formatDate(item.startDate)} 시작 · {item.periodDays}일간
                      </Text>
                      {(item.participantCount > 0 || seatsLeft != null) && (
                        <Text style={styles.meta}>
                          {[
                            item.participantCount > 0 ? `${item.participantCount}명 참여` : null,
                            seatsLeft != null ? `${seatsLeft}자리 남음` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      )}
                    </View>
                    <View style={styles.rewardChip}>
                      <Text style={styles.reward}>
                        완주 보상 {format.formatPoints(item.reward?.points ?? 0)}
                      </Text>
                    </View>
                  </View>
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
  card: { gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  title: { ...typography.subtitle, color: colors.text },
  description: { ...typography.caption, color: colors.textSub },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  footerLeft: { flex: 1, gap: 2 },
  meta: { ...typography.caption, color: colors.textSub },
  rewardChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
  },
  reward: { ...typography.caption, color: colors.primary, fontWeight: '700' },
});
