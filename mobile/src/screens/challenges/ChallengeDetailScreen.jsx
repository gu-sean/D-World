// CHALLENGE-02 챌린지 상세
//
// 챌린지 하나의 내용·기간·완주 조건·보상을 보여 주고 참여 신청을 받는다.
//
// 버튼은 상황마다 다르다 — 모집 중이고 아직 참여하지 않았으면 "참여하기",
// 이미 참여 중이면 순위 보기, 끝난 챌린지는 결과 보기. 정원이 찼으면 신청이
// 막히므로 눌리지 않게 한다.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  format,
  labels,
  useChallenge,
  useJoinChallenge,
} from '../../client';
import {
  Button,
  Card,
  CategoryChip,
  ErrorBanner,
  Icon,
  ProgressBar,
  QueryState,
  Screen,
  StatusTag,
} from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

export default function ChallengeDetailScreen({ navigation, route }) {
  const { challengeId } = route.params ?? {};

  const challenge = useChallenge(challengeId);
  const join = useJoinChallenge();

  return (
    <Screen title="챌린지" onBack={() => navigation.goBack()} padded={false}>
      <ErrorBanner error={join.error} />

      <QueryState query={challenge}>
        {(data) => {
          const mine = data.myParticipation;
          const full =
            data.maxParticipants != null && data.participantCount >= data.maxParticipants;
          const joinable = data.phase === 'recruiting' && !mine && !full;

          return (
            <>
              <ScrollView contentContainerStyle={styles.body}>
                <View style={styles.head}>
                  <View style={styles.tagRow}>
                    <CategoryChip categoryCode={data.categoryCode} size="sm" />
                    <StatusTag
                      text={labels.challengePhase[data.phase]}
                      tone={data.phase === 'ongoing' ? 'success' : 'neutral'}
                    />
                    {data.isClosingSoon && <StatusTag text="곧 시작" tone="warning" />}
                  </View>
                  <Text style={styles.title}>{data.title}</Text>
                  <Text style={styles.description}>{data.description}</Text>
                </View>

                <Card style={styles.card}>
                  <Text style={styles.cardLabel}>기간과 조건</Text>
                  <View style={styles.row}>
                    <Icon name="calendar" size={16} color={colors.textSub} />
                    <Text style={styles.rowText}>
                      {format.formatDate(data.startDate)} ~ {format.formatDate(data.endDate)} (
                      {data.periodDays}일)
                    </Text>
                  </View>
                  <View style={styles.row}>
                    <Icon name="check" size={16} color={colors.textSub} />
                    <Text style={styles.rowText}>
                      {data.periodDays}일 중 {data.requiredSuccessDays}일 성공하면 완주
                    </Text>
                  </View>
                  {data.targetValue != null && (
                    <View style={styles.row}>
                      <Icon name="flag" size={16} color={colors.textSub} />
                      <Text style={styles.rowText}>
                        하루 {format.formatTarget(data.targetValue, data.targetUnit)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.row}>
                    <Icon name="camera" size={16} color={colors.textSub} />
                    <Text style={styles.rowText}>
                      {data.verificationMethod === 'sensor' ? '센서로 인증' : '촬영으로 인증'}
                    </Text>
                  </View>
                </Card>

                <Card style={styles.card}>
                  <Text style={styles.cardLabel}>참여 인원</Text>
                  <Text style={styles.people}>
                    {data.participantCount}명
                    {data.maxParticipants != null ? ` / ${data.maxParticipants}명` : ''}
                  </Text>
                  {data.maxParticipants != null && (
                    <ProgressBar rate={data.participantCount / data.maxParticipants} />
                  )}
                  {full && <Text style={styles.fullText}>정원이 다 찼어요.</Text>}
                </Card>

                <Card style={styles.card}>
                  <Text style={styles.cardLabel}>완주 보상</Text>
                  <Text style={styles.reward}>
                    {format.formatPoints(data.reward?.points ?? 0)}
                    {data.reward?.userXp ? ` · 경험치 ${data.reward.userXp}` : ''}
                    {data.reward?.petXp ? ` · 펫 경험치 ${data.reward.petXp}` : ''}
                  </Text>
                  {!!data.reward?.badge && (
                    <View style={styles.row}>
                      <Icon name="trophy" size={16} color={colors.warning} />
                      <Text style={styles.rowText}>배지 「{data.reward.badge.title}」</Text>
                    </View>
                  )}
                </Card>

                {!!mine && (
                  <Card style={styles.card}>
                    <Text style={styles.cardLabel}>내 진행</Text>
                    <Text style={styles.rowText}>
                      {labels.challengeParticipationStatus[mine.status]} · 성공{' '}
                      {mine.successfulDays}일 / {data.requiredSuccessDays}일
                    </Text>
                    <ProgressBar
                      rate={mine.successfulDays / data.requiredSuccessDays}
                    />
                  </Card>
                )}
              </ScrollView>

              <View style={styles.footer}>
                {joinable && (
                  <Button
                    title="참여하기"
                    onPress={() => join.mutate({ challengeId })}
                    loading={join.isPending}
                    full
                  />
                )}

                {!joinable && !mine && (
                  <Button
                    title={full ? '정원이 찼어요' : '지금은 참여할 수 없어요'}
                    onPress={() => {}}
                    disabled
                    full
                  />
                )}

                {!!mine && data.phase !== 'ended' && (
                  <Button
                    title="순위 보기"
                    onPress={() =>
                      navigation.navigate(Routes.CHALLENGE_RANKING, { challengeId })
                    }
                    full
                  />
                )}

                {data.phase === 'ended' && !!mine && (
                  <Button
                    title="결과 보기"
                    onPress={() => navigation.navigate(Routes.CHALLENGE_RESULT, { challengeId })}
                    full
                  />
                )}
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
  head: { gap: spacing.xs },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  title: { ...typography.title, color: colors.text },
  description: { ...typography.body, color: colors.textSub },
  card: { gap: spacing.xs },
  cardLabel: { ...typography.caption, color: colors.textSub },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { ...typography.body, color: colors.text, flex: 1 },
  people: { ...typography.subtitle, color: colors.text },
  fullText: { ...typography.caption, color: colors.warning },
  reward: { ...typography.subtitle, color: colors.primary },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
