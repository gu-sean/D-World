// CHALLENGE-03 내 챌린지
//
// 내가 참여한 챌린지를 상태별로 모아 본다. 참여 중인 챌린지는 오늘 할 일이
// 남았는지(`todayStatus`)가 가장 중요하므로 맨 위에 두고, 눌러서 오늘 미션으로
// 바로 갈 수 있게 한다.
//
// 중도 포기는 되돌릴 수 없으므로 한 번 더 묻는다.
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { labels, useLeaveChallenge, useMyChallenges } from '../../client';
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorBanner,
  OptionRow,
  ProgressBar,
  QueryState,
  Screen,
  StatusTag,
} from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const TABS = [
  { value: 'enrolled', label: '참여 중' },
  { value: 'completed', label: '완주' },
  { value: 'failed', label: '미달성' },
  { value: 'withdrawn', label: '포기' },
];

const TODAY_TONE = { pending: 'warning', success: 'success', failed: 'danger', none: 'neutral' };

export default function MyChallengesScreen({ navigation }) {
  const [status, setStatus] = useState('enrolled');
  const [leaving, setLeaving] = useState(null);

  const mine = useMyChallenges(status);
  const leave = useLeaveChallenge();

  const quit = () =>
    leave.mutate(
      { challengeId: leaving.challenge.id },
      { onSuccess: () => setLeaving(null) },
    );

  return (
    <Screen title="내 챌린지" onBack={() => navigation.goBack()} padded={false}>
      <ErrorBanner error={leave.error} />

      <View style={styles.tabs}>
        <OptionRow options={TABS} value={status} onChange={setStatus} />
      </View>

      <QueryState
        query={mine}
        isEmpty={(mine.data ?? []).length === 0}
        emptyTitle="해당하는 챌린지가 없어요"
        emptyText="챌린지 둘러보기에서 마음에 드는 챌린지를 찾아 보세요.">
        {(list) => (
          <FlatList
            data={list}
            keyExtractor={(item) => item.challenge.id}
            contentContainerStyle={styles.list}
            refreshing={mine.isFetching}
            onRefresh={mine.refetch}
            renderItem={({ item }) => {
              const { challenge, todayStatus, todayMissionId, daysLeft } = item;
              const participation = challenge.myParticipation;

              return (
                <Card style={styles.card}>
                  <View style={styles.topRow}>
                    <Text style={styles.title} numberOfLines={1}>
                      {challenge.title}
                    </Text>
                    {status === 'enrolled' ? (
                      <StatusTag
                        text={labels.challengeDailyMissionStatus[todayStatus] ?? '기간 밖'}
                        tone={TODAY_TONE[todayStatus] ?? 'neutral'}
                      />
                    ) : (
                      <StatusTag
                        text={labels.challengeParticipationStatus[participation?.status]}
                        tone={participation?.status === 'completed' ? 'success' : 'neutral'}
                      />
                    )}
                  </View>

                  <Text style={styles.meta}>
                    성공 {participation?.successfulDays ?? 0}일 /{' '}
                    {challenge.requiredSuccessDays}일 필요
                    {status === 'enrolled' ? ` · ${daysLeft}일 남음` : ''}
                  </Text>

                  <ProgressBar
                    rate={(participation?.successfulDays ?? 0) / challenge.requiredSuccessDays}
                  />

                  <View style={styles.actions}>
                    {status === 'enrolled' && todayStatus === 'pending' && !!todayMissionId && (
                      <Button
                        title="오늘 미션 하기"
                        size="sm"
                        onPress={() =>
                          navigation.navigate(Routes.MISSION_DETAIL, {
                            missionId: todayMissionId,
                          })
                        }
                      />
                    )}
                    <Button
                      title="순위"
                      variant="secondary"
                      size="sm"
                      onPress={() =>
                        navigation.navigate(Routes.CHALLENGE_RANKING, {
                          challengeId: challenge.id,
                        })
                      }
                    />
                    {status === 'enrolled' ? (
                      <Button
                        title="포기"
                        variant="text"
                        size="sm"
                        onPress={() => setLeaving(item)}
                      />
                    ) : (
                      <Button
                        title="결과"
                        variant="text"
                        size="sm"
                        onPress={() =>
                          navigation.navigate(Routes.CHALLENGE_RESULT, {
                            challengeId: challenge.id,
                          })
                        }
                      />
                    )}
                  </View>
                </Card>
              );
            }}
          />
        )}
      </QueryState>

      <ConfirmDialog
        visible={!!leaving}
        title="이 챌린지를 포기할까요?"
        message={
          leaving
            ? `${leaving.challenge.title}\n포기하면 다시 참여할 수 없고 보상도 받지 못해요.`
            : ''
        }
        confirmText="포기하기"
        danger
        loading={leave.isPending}
        onConfirm={quit}
        onCancel={() => setLeaving(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { padding: spacing.lg, paddingBottom: 0, alignItems: 'flex-start' },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  card: { gap: spacing.xs },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  meta: { ...typography.caption, color: colors.textSub },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs, flexWrap: 'wrap' },
});
