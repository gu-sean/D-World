// MAIN-01 홈
//
// 하루를 여는 화면. 위에서부터 인사말, 한 주 달력, 오늘 진행률, 오늘의 미션,
// 참여 중인 챌린지 배너, 상황 추천 입구 순으로 쌓인다.
//
// 날짜를 바꿔 가며 볼 수 있다. 달력에서 다른 날을 고르면 그 날짜로 다시 조회하고,
// 미션을 누르면 상세로 간다. 인사말·정렬·진행률은 모두 서버가 계산한 값을 그대로 쓴다.
import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  format,
  useActiveRecommendations,
  useHome,
  useMyChallenges,
} from '../../client';
import {
  Button,
  Card,
  Icon,
  MissionCard,
  ProgressRing,
  QueryState,
  Screen,
  SectionTitle,
  StatusTag,
  WeekStrip,
} from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

export default function HomeScreen({ navigation }) {
  const [date, setDate] = useState(() => format.todayKst());

  const home = useHome(date);
  const myChallenges = useMyChallenges('enrolled');
  const recommendations = useActiveRecommendations();

  const activeChallenge = (myChallenges.data ?? [])[0];
  const recommendation = (recommendations.data ?? [])[0];

  return (
    <Screen padded={false}>
      <QueryState query={home}>
        {(summary) => (
          <ScrollView
            contentContainerStyle={styles.body}
            refreshControl={
              <RefreshControl refreshing={home.isFetching} onRefresh={home.refetch} />
            }>
            <View style={styles.greeting}>
              <Text style={styles.message}>{summary.message}</Text>
              <Text style={styles.date}>{format.formatDate(summary.date)}</Text>
            </View>

            <Card>
              <WeekStrip days={summary.week} selectedDate={date} onSelect={setDate} />
            </Card>

            <Card style={styles.progressCard}>
              <ProgressRing rate={summary.summary.progressRate} />
              <View style={styles.progressTexts}>
                <Text style={styles.progressTitle}>
                  오늘 {summary.summary.completedCount} / {summary.summary.totalCount}
                </Text>
                <Text style={styles.progressSub}>
                  {summary.summary.streakDays > 0
                    ? `${summary.summary.streakDays}일 연속 달성 중`
                    : '오늘 하나만 해내도 연속 기록이 시작돼요'}
                </Text>
              </View>
            </Card>

            <View>
              <SectionTitle
                title="오늘의 미션"
                actionText="관리"
                onAction={() => navigation.navigate(Routes.MISSION_MANAGE, { date })}
              />
              {summary.missions.length === 0 ? (
                <Card>
                  <Text style={styles.emptyText}>이 날짜에 할 미션이 없어요.</Text>
                  <View style={styles.emptyButton}>
                    <Button
                      title="미션 추가하기"
                      variant="secondary"
                      size="sm"
                      onPress={() => navigation.navigate(Routes.MISSION_CATALOG, { date })}
                    />
                  </View>
                </Card>
              ) : (
                <View style={styles.missions}>
                  {summary.missions.map((mission) => (
                    <MissionCard
                      key={mission.id}
                      mission={mission}
                      onPress={() =>
                        navigation.navigate(Routes.MISSION_DETAIL, { missionId: mission.id })
                      }
                    />
                  ))}
                </View>
              )}
            </View>

            {!!activeChallenge && (
              <Card
                onPress={() =>
                  navigation.navigate(Routes.CHALLENGE_DETAIL, {
                    challengeId: activeChallenge.challenge.id,
                  })
                }
                style={styles.challenge}>
                <View style={styles.challengeTop}>
                  <View style={styles.challengeTitleRow}>
                    <Icon name="trophy" size={18} color={colors.warning} />
                    <Text style={styles.challengeTitle} numberOfLines={1}>
                      {activeChallenge.challenge.title}
                    </Text>
                  </View>
                  <StatusTag
                    text={activeChallenge.todayStatus === 'success' ? '오늘 완료' : '오늘 남음'}
                    tone={activeChallenge.todayStatus === 'success' ? 'success' : 'warning'}
                  />
                </View>
                <Text style={styles.challengeMeta}>
                  {activeChallenge.challenge.myParticipation?.successfulDays ?? 0}일 성공 ·{' '}
                  {activeChallenge.daysLeft}일 남음
                </Text>
              </Card>
            )}

            <Card
              onPress={() => navigation.navigate(Routes.SITUATION_RECOMMEND, { kind: 'location' })}
              style={styles.recommend}>
              <View style={styles.recommendRow}>
                <Icon name="pin" size={20} color={colors.primary} />
                <View style={styles.recommendTexts}>
                  <Text style={styles.recommendTitle}>
                    {recommendation ? recommendation.title : '지금 할 만한 미션 찾기'}
                  </Text>
                  <Text style={styles.recommendSub} numberOfLines={1}>
                    {recommendation
                      ? recommendation.reason
                      : '날씨와 시간대에 맞는 미션을 추천해 드려요'}
                  </Text>
                </View>
                <Icon name="chevronRight" size={18} color={colors.border} />
              </View>
            </Card>
          </ScrollView>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  greeting: { gap: 2 },
  message: { ...typography.title, color: colors.text },
  date: { ...typography.caption, color: colors.textSub },
  progressCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  progressTexts: { flex: 1, gap: spacing.xs },
  progressTitle: { ...typography.subtitle, color: colors.text },
  progressSub: { ...typography.caption, color: colors.textSub },
  missions: { gap: spacing.sm },
  emptyText: { ...typography.body, color: colors.textSub },
  emptyButton: { marginTop: spacing.md, alignSelf: 'flex-start' },
  challenge: { gap: spacing.xs },
  challengeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  challengeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 },
  challengeTitle: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  challengeMeta: { ...typography.caption, color: colors.textSub },
  recommend: { paddingVertical: spacing.md },
  recommendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  recommendTexts: { flex: 1, gap: 2 },
  recommendTitle: { ...typography.bodyStrong, color: colors.text },
  recommendSub: { ...typography.caption, color: colors.textSub },
});
