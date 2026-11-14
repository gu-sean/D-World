// CHALLENGE-05 챌린지 결과
//
// 챌린지가 끝난 뒤 내 결과를 보여 준다. 정산이 아직 끝나지 않았으면(`settled`가
// 거짓) 여기 숫자는 예상값이므로 그 사실을 분명히 적는다.
//
// 보상은 완주했을 때만 내려오므로, 없으면 보상 칸을 아예 그리지 않는다.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { format, labels, useChallenge, useChallengeResult } from '../../client';
import {
  Button,
  Card,
  Icon,
  ProgressRing,
  QueryState,
  Screen,
  StatusTag,
} from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const OUTCOME = {
  completed: { icon: 'trophy', color: colors.warning, heading: '완주했어요!' },
  failed: { icon: 'flag', color: colors.textSub, heading: '아쉽게 못 채웠어요' },
  withdrawn: { icon: 'logout', color: colors.textSub, heading: '중간에 그만뒀어요' },
  disqualified: { icon: 'alert', color: colors.danger, heading: '실격 처리됐어요' },
};

export default function ChallengeResultScreen({ navigation, route }) {
  const { challengeId } = route.params ?? {};

  const result = useChallengeResult(challengeId);
  const challenge = useChallenge(challengeId);

  return (
    <Screen title="챌린지 결과" onBack={() => navigation.goBack()} padded={false}>
      <QueryState query={result}>
        {(data) => {
          const look = OUTCOME[data.outcome] ?? OUTCOME.failed;

          return (
            <>
              <ScrollView contentContainerStyle={styles.body}>
                <View style={styles.hero}>
                  <Icon name={look.icon} size={52} color={look.color} />
                  <Text style={styles.heading}>{look.heading}</Text>
                  {!!challenge.data?.title && (
                    <Text style={styles.challengeTitle}>{challenge.data.title}</Text>
                  )}
                  <StatusTag
                    text={labels.challengeParticipationStatus[data.outcome]}
                    tone={data.outcome === 'completed' ? 'success' : 'neutral'}
                  />
                </View>

                {!data.settled && (
                  <Card style={styles.notice}>
                    <Text style={styles.noticeText}>
                      아직 정산 중이에요. 아래 숫자는 예상값이고, 확정되면 바뀔 수 있어요.
                    </Text>
                  </Card>
                )}

                <Card style={styles.summary}>
                  <ProgressRing rate={data.achievementRate} size={120} />
                  <Text style={styles.rate}>{format.formatRate(data.achievementRate)} 달성</Text>
                  <Text style={styles.days}>
                    성공 {data.successfulDays}일
                    {challenge.data ? ` / ${challenge.data.periodDays}일` : ''}
                  </Text>
                  {data.rankNo != null && <Text style={styles.rank}>{data.rankNo}위</Text>}
                </Card>

                {!!data.rewards && (
                  <Card style={styles.rewardCard}>
                    <Text style={styles.cardLabel}>받은 보상</Text>
                    <Text style={styles.reward}>
                      {format.formatPoints(data.rewards.points)}
                      {data.rewards.userXp ? ` · 경험치 ${data.rewards.userXp}` : ''}
                      {data.rewards.petXp ? ` · 펫 경험치 ${data.rewards.petXp}` : ''}
                    </Text>
                    {!!data.rewards.badge && (
                      <View style={styles.badgeRow}>
                        <Icon name="trophy" size={16} color={colors.warning} />
                        <Text style={styles.badgeText}>배지 「{data.rewards.badge.title}」</Text>
                      </View>
                    )}
                  </Card>
                )}
              </ScrollView>

              <View style={styles.footer}>
                <Button
                  title="최종 순위 보기"
                  variant="secondary"
                  onPress={() => navigation.navigate(Routes.CHALLENGE_RANKING, { challengeId })}
                  full
                />
                <Button
                  title="다른 챌린지 보기"
                  onPress={() =>
                    // 이 화면은 루트 스택이라 챌린지 탭 첫 화면으로 보낸다
                    navigation.navigate(Routes.MAIN, {
                      screen: Routes.CHALLENGES_TAB,
                      params: { screen: Routes.CHALLENGE_HOME },
                    })
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
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg },
  heading: { ...typography.title, color: colors.text },
  challengeTitle: { ...typography.body, color: colors.textSub, textAlign: 'center' },
  notice: {},
  noticeText: { ...typography.caption, color: colors.warning },
  summary: { alignItems: 'center', gap: spacing.xs },
  rate: { ...typography.subtitle, color: colors.text },
  days: { ...typography.body, color: colors.textSub },
  rank: { ...typography.bodyStrong, color: colors.primary },
  rewardCard: { gap: spacing.xs },
  cardLabel: { ...typography.caption, color: colors.textSub },
  reward: { ...typography.subtitle, color: colors.primary },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badgeText: { ...typography.body, color: colors.text },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
