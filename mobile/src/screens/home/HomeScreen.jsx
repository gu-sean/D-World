// MAIN-01 홈
//
// 하루를 여는 화면. 위에서부터 인사말, 한 주 달력, 오늘 진행률, 오늘의 미션,
// 참여 중인 챌린지 배너, 상황 추천 입구 순으로 쌓인다.
//
// 날짜를 바꿔 가며 볼 수 있다. 달력에서 다른 날을 고르면 그 날짜로 다시 조회하고,
// 미션을 누르면 상세로 간다. 인사말·정렬·진행률은 모두 서버가 계산한 값을 그대로 쓴다.
import React, { useState } from 'react';
import { ImageBackground, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  format,
  labels,
  useActiveRecommendations,
  useHome,
  useMe,
  useMyChallenges,
} from '../../client';
import {
  Button,
  Card,
  Icon,
  MissionCard,
  OptionRow,
  ProgressRing,
  QueryState,
  Screen,
  SectionTitle,
  StatusTag,
  WeekStrip,
} from '../../components';
import Routes from '../../navigation/routes';
import { colors, radius, spacing, typography } from '../../theme';

/** 배너 부제: 오늘 미션 상태에 따라 바뀐다 */
function bannerSubText({ totalCount, completedCount }) {
  if (totalCount === 0) return '첫 미션을 골라 볼까요?';
  if (completedCount >= totalCount) return '오늘 할 일을\n모두 끝냈어요';
  return '하나 더 하면 연속 기록이\n이어져요';
}

/**
 * 오늘의 미션 상태 필터. 각 칸이 어떤 미션 상태를 묶어 보여 주는지 정한다.
 * '진행 중'에는 인증 중(submitted)도 넣는다 — 사용자가 손댄 뒤 아직 끝나지 않은 미션이라서.
 * 실패·취소는 '전체'에서만 보인다.
 */
const MISSION_FILTERS = [
  { value: 'all', label: '전체', statuses: null },
  { value: 'scheduled', label: labels.missionStatus.scheduled, statuses: ['scheduled'] },
  {
    value: 'in_progress',
    label: labels.missionStatus.in_progress,
    statuses: ['in_progress', 'submitted'],
  },
  { value: 'completed', label: labels.missionStatus.completed, statuses: ['completed'] },
];

function filterMissions(missions, filterValue) {
  const filter = MISSION_FILTERS.find((f) => f.value === filterValue);
  if (!filter?.statuses) return missions;
  return missions.filter((mission) => filter.statuses.includes(mission.status));
}

export default function HomeScreen({ navigation }) {
  const [date, setDate] = useState(() => format.todayKst());
  const [missionFilter, setMissionFilter] = useState('all');

  const home = useHome(date);
  const me = useMe();
  const myChallenges = useMyChallenges('enrolled');
  const recommendations = useActiveRecommendations();

  const activeChallenge = (myChallenges.data ?? [])[0];
  const recommendation = (recommendations.data ?? [])[0];

  return (
    <Screen padded={false}>
      <QueryState skeleton="summary" query={home}>
        {(summary) => (
          <ScrollView
            contentContainerStyle={styles.body}
            refreshControl={
              <RefreshControl refreshing={home.isFetching} onRefresh={home.refetch} />
            }>
            <View style={styles.greeting}>
              <Text style={styles.message}>
                {me.data?.nickname
                  ? `${me.data.nickname}님, 오늘도 한 걸음 가볼까요?`
                  : summary.message}
              </Text>
              <Text style={styles.date}>{format.formatDate(summary.date)}</Text>
            </View>

            <ImageBackground
              source={require('../../assets/images/home-sunrise.png')}
              style={styles.banner}
              imageStyle={styles.bannerImage}
              resizeMode="cover">
              <View style={styles.bannerTexts}>
                <Text style={styles.bannerTitle}>오늘의 한 걸음</Text>
                <Text style={styles.bannerSub}>{bannerSubText(summary.summary)}</Text>
              </View>
            </ImageBackground>

            <Card style={styles.dayCard}>
              <WeekStrip days={summary.week} selectedDate={date} onSelect={setDate} />
              <View style={styles.divider} />
              <View style={styles.progressRow}>
                <ProgressRing rate={summary.summary.progressRate} />
                <View style={styles.progressTexts}>
                  <Text style={styles.progressTitle}>
                    {summary.summary.totalCount === 0
                      ? '오늘 할 미션이 없어요'
                      : `오늘 ${summary.summary.totalCount}개 중 ${summary.summary.completedCount}개 완료`}
                  </Text>
                  <Text style={styles.progressSub}>
                    {summary.summary.totalCount === 0
                      ? '미션을 추가하면 진행률이 여기에 보여요'
                      : summary.summary.streakDays > 0
                      ? `${summary.summary.streakDays}일 연속 달성 중`
                      : '오늘 하나만 해내도 연속 기록이 시작돼요'}
                  </Text>
                </View>
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
                      icon="plus"
                      full
                      onPress={() => navigation.navigate(Routes.MISSION_CATALOG, { date })}
                    />
                  </View>
                </Card>
              ) : (
                <View style={styles.missions}>
                  <OptionRow
                    size="sm"
                    options={MISSION_FILTERS}
                    value={missionFilter}
                    onChange={setMissionFilter}
                  />
                  {(() => {
                    const visible = filterMissions(summary.missions, missionFilter);
                    if (visible.length === 0) {
                      const label = MISSION_FILTERS.find((f) => f.value === missionFilter)?.label;
                      return (
                        <Card>
                          <Text style={styles.emptyText}>{label} 미션이 없어요.</Text>
                        </Card>
                      );
                    }
                    return visible.map((mission) => (
                      <MissionCard
                        key={mission.id}
                        mission={mission}
                        onPress={() =>
                          navigation.navigate(Routes.MISSION_DETAIL, { missionId: mission.id })
                        }
                      />
                    ));
                  })()}
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

/** 홈 배너 그림(해 뜨는 언덕)에 맞춘 색 — 그림을 바꾸면 함께 바꾼다 */
const BANNER_FILL = '#FCE3C6';
const BANNER_SUB_TEXT = '#3F322B';

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  greeting: { gap: 2 },
  message: { ...typography.title, color: colors.text },
  date: { ...typography.caption, color: colors.textSub },
  banner: {
    height: 128,
    borderRadius: radius.lg,
    overflow: 'hidden',
    justifyContent: 'center',
    backgroundColor: BANNER_FILL,
  },
  bannerImage: { borderRadius: radius.lg },
  bannerTexts: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  bannerTitle: { ...typography.title, color: colors.text },
  bannerSub: { ...typography.caption, color: BANNER_SUB_TEXT },
  dayCard: { gap: spacing.sm },
  divider: { height: 1, backgroundColor: colors.border },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  progressTexts: { flex: 1, gap: spacing.xs },
  progressTitle: { ...typography.subtitle, color: colors.text },
  progressSub: { ...typography.caption, color: colors.textSub },
  missions: { gap: spacing.sm },
  emptyText: { ...typography.body, color: colors.textSub },
  emptyButton: { marginTop: spacing.md },
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
