// REPORT-01 리포트 (리포트 탭)
//
// 고른 기간(주·월·전체)의 성적표다. 위에서부터 달성률 요약, 분야별 진행,
// AI 인사이트, 다음 주 제안 순으로 보여 준다.
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
  OptionRow,
  ProgressBar,
  ProgressRing,
  QueryState,
  Screen,
  SectionTitle,
} from '../../components';
import Routes from '../../navigation/routes';
import { categoryStyle, colors, spacing, typography } from '../../theme';

const PERIODS = [
  { value: 'week', label: '주간' },
  { value: 'month', label: '월간' },
  { value: 'all', label: '전체' },
];

/** 분야별 진행은 그 기간의 완료 미션 수 / 계획 미션 수다 (07 §10 ReportSummary.categories). */
function progressText(item) {
  return `${format.formatNumber(item.completedCount)}개 / ${format.formatNumber(item.plannedCount)}개`;
}

export default function ReportScreen({ navigation }) {
  const [period, setPeriod] = useState('week');
  const [categoryCode, setCategoryCode] = useState(null);

  const categories = useGoalCategories();
  const report = useReportSummary(categoryCode ? { period, categoryCode } : { period });

  const categoryOptions = [
    { value: null, label: '전체' },
    ...(categories.data ?? []).map((c) => ({ value: c.code, label: c.name })),
  ];
  const categoryName = (code) =>
    (categories.data ?? []).find((c) => c.code === code)?.name ?? code;

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
        <OptionRow options={PERIODS} value={period} onChange={setPeriod} />
        <OptionRow options={categoryOptions} value={categoryCode} onChange={setCategoryCode} />
      </View>

      <QueryState query={report}>
        {(summary) => (
          <ScrollView
            contentContainerStyle={styles.body}
            refreshControl={
              <RefreshControl refreshing={report.isFetching} onRefresh={report.refetch} />
            }>
            <Text style={styles.period}>
              {format.formatDate(summary.periodStart)} ~ {format.formatDate(summary.periodEnd)}
            </Text>

            <Card style={styles.summaryCard}>
              <ProgressRing rate={summary.achievementRate} />
              <View style={styles.summaryTexts}>
                <Text style={styles.summaryTitle}>
                  미션 {summary.completedMissionCount} / {summary.plannedMissionCount}
                </Text>
                <Text style={styles.summarySub}>
                  목표 진행 평균 {Math.round(summary.goalProgressRate * 100)}%
                </Text>
                <Text style={styles.summarySub}>{summary.streakDays}일 연속 달성</Text>
              </View>
            </Card>

            <View>
              <SectionTitle title="분야별 진행" />
              <Card style={styles.categories}>
                {summary.categories.length === 0 && (
                  <Text style={styles.categoryEmpty}>이 기간에 기록된 미션이 없어요.</Text>
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
  filters: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  period: { ...typography.caption, color: colors.textSub },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  summaryTexts: { flex: 1, gap: 2 },
  summaryTitle: { ...typography.subtitle, color: colors.text },
  summarySub: { ...typography.caption, color: colors.textSub },
  categories: { gap: spacing.md },
  categoryRow: { gap: spacing.xs },
  categoryEmpty: { ...typography.caption, color: colors.textSub },
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
