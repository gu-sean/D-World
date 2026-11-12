// AI 리포트 상세 (리포트 탭의 인사이트에서 들어온다)
//
// 주간·월간 AI 리포트 전문을 보여 준다. 요약, 피드백, 다음에 해볼 만한 목표 순이다.
// 화면을 열면 읽음으로 표시해서 알림 배지가 사라지게 한다.
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { format, useAiReport, useMarkAiReportRead } from '../../client';
import { Card, CategoryChip, QueryState, Screen, SectionTitle } from '../../components';
import { colors, spacing, typography } from '../../theme';

const RUN_TYPE_LABEL = { weekly_report: '주간 리포트', monthly_report: '월간 리포트' };

export default function AiReportDetailScreen({ navigation, route }) {
  const { runId } = route.params ?? {};
  const report = useAiReport(runId);
  const markRead = useMarkAiReportRead();

  // 아직 안 읽은 리포트면 한 번만 읽음 처리한다.
  useEffect(() => {
    if (report.data && !report.data.readAt) {
      markRead.mutate({ runId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.data?.runId]);

  return (
    <Screen title="AI 리포트" onBack={() => navigation.goBack()} padded={false}>
      <QueryState query={report}>
        {(data) => (
          <ScrollView contentContainerStyle={styles.body}>
            <View style={styles.head}>
              <Text style={styles.type}>{RUN_TYPE_LABEL[data.runType] ?? data.runType}</Text>
              <Text style={styles.title}>{data.title}</Text>
              <Text style={styles.period}>
                {format.formatDate(data.periodStart)} ~ {format.formatDate(data.periodEnd)}
              </Text>
            </View>

            <Card>
              <Text style={styles.summary}>{data.summary}</Text>
            </Card>

            {!!data.feedback && (
              <View>
                <SectionTitle title="피드백" />
                <Card>
                  <Text style={styles.feedback}>{data.feedback}</Text>
                </Card>
              </View>
            )}

            {(data.nextGoals ?? []).length > 0 && (
              <View>
                <SectionTitle title="다음에 해볼 만한 것" />
                <View style={styles.goals}>
                  {data.nextGoals.map((goal, index) => (
                    <Card key={index} style={styles.goalCard}>
                      {!!goal.categoryCode && (
                        <CategoryChip categoryCode={goal.categoryCode} size="sm" />
                      )}
                      <Text style={styles.goalText}>{goal.text}</Text>
                    </Card>
                  ))}
                </View>
              </View>
            )}

            <Text style={styles.generated}>{format.formatDateTime(data.generatedAt)} 작성</Text>
          </ScrollView>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  head: { gap: spacing.xs },
  type: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  title: { ...typography.title, color: colors.text },
  period: { ...typography.caption, color: colors.textSub },
  summary: { ...typography.body, color: colors.text },
  feedback: { ...typography.body, color: colors.text },
  goals: { gap: spacing.sm },
  goalCard: { gap: spacing.xs },
  goalText: { ...typography.body, color: colors.text },
  generated: { ...typography.caption, color: colors.textSub, textAlign: 'center' },
});
