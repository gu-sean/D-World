// REPORT-01 리포트 (리포트 탭)
//
// 고른 기간(주·월·전체)의 성적표다. 위에서부터 달성률 요약,
// (주간이면) 요일별 완료 막대 / (월간이면) 날짜별 달성 잔디 달력 / (전체면) 누적 기록,
// 분야별 진행, AI 인사이트, 다음 주 제안 순으로 보여 준다.
//
// 분야 필터를 바꿔도 분야별 진행 막대는 항상 세 분야를 모두 보여 준다 —
// 서버가 그렇게 내려 주기 때문이다. 오른쪽 위 달력 버튼으로 월별 보기로 간다.
import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { format, useGoalCategories, useReportSummary } from '../../client';
import {
  Button,
  Card,
  Icon,
  LifetimeStats,
  OptionRow,
  ProgressBar,
  ProgressRing,
  QueryState,
  Screen,
  SectionTitle,
  SegmentedControl,
  MonthlyHeatmap,
  WeeklyBarChart,
} from '../../components';
import Routes from '../../navigation/routes';
import { categoryStyle, colors, radius, spacing, typography } from '../../theme';

const PERIODS = [
  { value: 'week', label: '주간' },
  { value: 'month', label: '월간' },
  { value: 'all', label: '전체' },
];

/** 기록이 없을 때 안내 문구에 쓰는 기간 이름 */
const PERIOD_WORD = { week: '이번 주', month: '이번 달', all: '' };

/** 분야별 진행은 그 기간의 완료 미션 수 / 계획 미션 수다 (07 §10 ReportSummary.categories). */
function progressText(item) {
  return `${format.formatNumber(item.completedCount)}개 / ${format.formatNumber(
    item.plannedCount,
  )}개`;
}

/** 선택한 기간에 계획·완료한 미션이 하나도 없으면 숫자 대신 시작을 권한다 */
const isBlank = (summary) =>
  summary.plannedMissionCount === 0 && summary.completedMissionCount === 0;

export default function ReportScreen({ navigation }) {
  const [period, setPeriod] = useState('week');
  const [categoryCode, setCategoryCode] = useState(null);

  const categories = useGoalCategories();
  const report = useReportSummary(categoryCode ? { period, categoryCode } : { period });

  const categoryOptions = [
    { value: null, label: '전체' },
    ...(categories.data ?? []).map((c) => ({ value: c.code, label: c.name })),
  ];
  // 기록이 없는 기간에도 분야별 막대 틀은 보여 준다(선택한 분야가 있으면 그 분야만)
  // 분야가 하나뿐이면 분야 필터와 '분야별 진행'은 같은 말을 반복하므로 숨긴다(분야가 늘면 다시 보인다)
  const showCategories = (categories.data ?? []).length > 1;
  const placeholderCategories = categoryOptions.filter(
    (c) => c.value !== null && (categoryCode === null || c.value === categoryCode),
  );
  const categoryName = (code) => (categories.data ?? []).find((c) => c.code === code)?.name ?? code;

  return (
    <Screen
      title="리포트"
      padded={false}
      right={
        <Button
          title="달력"
          size="sm"
          variant="text"
          icon="calendar"
          onPress={() => navigation.navigate(Routes.MONTHLY_CALENDAR)}
        />
      }>
      <View style={styles.filters}>
        <SegmentedControl options={PERIODS} value={period} onChange={setPeriod} />
        {showCategories && (
          <OptionRow
            label="분야"
            size="sm"
            options={categoryOptions}
            value={categoryCode}
            onChange={setCategoryCode}
          />
        )}
      </View>

      <QueryState skeleton="summary" query={report}>
        {(summary) => (
          <ScrollView
            contentContainerStyle={styles.body}
            refreshControl={
              <RefreshControl refreshing={report.isFetching} onRefresh={report.refetch} />
            }>
            <Text style={styles.period}>
              {format.formatDate(summary.periodStart)} ~ {format.formatDate(summary.periodEnd)}
            </Text>

            {isBlank(summary) ? (
              <Card style={styles.summaryCard}>
                <ProgressRing rate={0}>
                  <Text style={styles.ringBlank}>시작 전</Text>
                </ProgressRing>
                <View style={styles.summaryTexts}>
                  <Text style={styles.summaryTitle}>
                    {PERIOD_WORD[period] ? `${PERIOD_WORD[period]} 미션을` : '미션을'}
                    {'\n'}시작해 볼까요?
                  </Text>
                  <Text style={styles.summarySub}>완료하면 진행률이 올라가요</Text>
                  <View style={styles.streakChip}>
                    <Text style={styles.streakChipText}>
                      {summary.streakDays > 0
                        ? `${summary.streakDays}일 연속 달성 중`
                        : '오늘 시작하면 연속 1일!'}
                    </Text>
                  </View>
                </View>
              </Card>
            ) : (
              <Card style={styles.summaryCard}>
                <ProgressRing rate={summary.achievementRate} />
                <View style={styles.summaryTexts}>
                  <Text style={styles.summaryTitle}>
                    미션 {summary.plannedMissionCount}개 중 {summary.completedMissionCount}개 완료
                  </Text>
                  <Text style={styles.summarySub}>
                    목표 진행 평균 {Math.round(summary.goalProgressRate * 100)}%
                  </Text>
                  <Text style={styles.summarySub}>{summary.streakDays}일 연속 달성</Text>
                </View>
              </Card>
            )}

            {period === 'week' && (
              <Card>
                <WeeklyBarChart
                  startDate={summary.periodStart}
                  endDate={summary.periodEnd}
                  onMissionPress={(mission) =>
                    navigation.navigate(Routes.MISSION_DETAIL, { missionId: mission.id })
                  }
                />
              </Card>
            )}

            {period === 'month' && (
              <Card>
                <MonthlyHeatmap
                  month={summary.periodStart.slice(0, 7)}
                  onMissionPress={(mission) =>
                    navigation.navigate(Routes.MISSION_DETAIL, { missionId: mission.id })
                  }
                />
              </Card>
            )}

            {period === 'all' && (
              <Card>
                <LifetimeStats
                  completedMissionCount={summary.completedMissionCount}
                  // 연속 기록·포인트·업적 화면은 '마이' 탭 안에 있어 탭을 거쳐 연다 (linking.js와 같은 방식)
                  onNavigate={(route) => navigation.navigate(Routes.MY_TAB, { screen: route })}
                />
              </Card>
            )}

            {!showCategories && summary.categories.length === 0 && (
              <Card style={styles.categories}>
                <View style={styles.blankFooter}>
                  <Text style={styles.categoryEmpty}>아직 기록된 미션이 없어요</Text>
                  <Button
                    title="오늘의 미션 보기"
                    size="sm"
                    variant="text"
                    onPress={() => navigation.navigate(Routes.HOME_TAB)}
                  />
                </View>
              </Card>
            )}

            {showCategories && (
              <View>
                <SectionTitle title="분야별 진행" />
                <Card style={styles.categories}>
                  {summary.categories.length === 0 &&
                    placeholderCategories.map((c) => (
                      <View key={c.value} style={styles.categoryRow}>
                        <View style={styles.categoryHead}>
                          <Text style={styles.categoryName}>{c.label}</Text>
                          <Text style={styles.categoryValue}>0개 / 0개</Text>
                        </View>
                        <ProgressBar rate={0} color={categoryStyle(c.value).color} />
                      </View>
                    ))}
                  {summary.categories.length === 0 && (
                    <View style={styles.blankFooter}>
                      <Text style={styles.categoryEmpty}>아직 기록된 미션이 없어요</Text>
                      <Button
                        title="오늘의 미션 보기"
                        size="sm"
                        variant="text"
                        onPress={() => navigation.navigate(Routes.HOME_TAB)}
                      />
                    </View>
                  )}
                  {summary.categories.map((item) => (
                    <View key={item.categoryCode} style={styles.categoryRow}>
                      <View style={styles.categoryHead}>
                        <Text style={styles.categoryName}>{categoryName(item.categoryCode)}</Text>
                        <Text style={styles.categoryValue}>{progressText(item)}</Text>
                      </View>
                      <ProgressBar
                        rate={item.achievementRate}
                        color={categoryStyle(item.categoryCode).color}
                      />
                    </View>
                  ))}
                </Card>
              </View>
            )}

            {!!summary.insight && (
              <View>
                <SectionTitle title="AI 인사이트" />
                <Card
                  onPress={() =>
                    navigation.navigate(Routes.AI_REPORT_DETAIL, {
                      runId: summary.insight.aiReportRunId,
                    })
                  }
                  style={styles.insight}>
                  <Text style={styles.insightSummary}>{summary.insight.summary}</Text>
                  {!!summary.insight.feedback && (
                    <Text style={styles.insightFeedback}>{summary.insight.feedback}</Text>
                  )}
                  <View style={styles.moreRow}>
                    <Text style={styles.more}>자세히 보기</Text>
                    <Icon name="chevronRight" size={16} color={colors.primary} />
                  </View>
                </Card>
              </View>
            )}

            {!!summary.nextSuggestion && (
              <Card style={styles.suggestion}>
                <Text style={styles.suggestionLabel}>다음엔 이렇게 해볼까요?</Text>
                <Text style={styles.suggestionText}>{summary.nextSuggestion.text}</Text>
                {!!summary.nextSuggestion.planAdjustmentId && (
                  <Button
                    title="계획 조정안 보기"
                    size="sm"
                    variant="secondary"
                    onPress={() =>
                      navigation.navigate(Routes.PLAN_ADJUST_PROPOSAL, {
                        adjustmentId: summary.nextSuggestion.planAdjustmentId,
                      })
                    }
                  />
                )}
              </Card>
            )}
          </ScrollView>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  period: { ...typography.caption, color: colors.textSub },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  summaryTexts: { flex: 1, gap: 2 },
  summaryTitle: { ...typography.subtitle, color: colors.text },
  summarySub: { ...typography.caption, color: colors.textSub },
  categories: { gap: spacing.md },
  categoryRow: { gap: spacing.xs },
  categoryEmpty: { ...typography.caption, color: colors.textSub },
  blankFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
  },
  ringBlank: { ...typography.caption, color: colors.textSub, fontWeight: '600' },
  streakChip: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
  },
  streakChipText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  categoryHead: { flexDirection: 'row', justifyContent: 'space-between' },
  categoryName: { ...typography.body, color: colors.text },
  categoryValue: { ...typography.caption, color: colors.textSub },
  insight: { gap: spacing.xs },
  insightSummary: { ...typography.body, color: colors.text },
  insightFeedback: { ...typography.caption, color: colors.textSub },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: spacing.xs },
  more: { ...typography.caption, color: colors.primary },
  suggestion: { gap: spacing.sm },
  suggestionLabel: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  suggestionText: { ...typography.body, color: colors.text },
});
