// STREAK-01 연속 달성
//
// 며칠째 이어 오고 있는지, 최고 기록은 얼마인지 보여 준다.
// 이번 주 일곱 칸은 날마다 성공·실패·판정 대기를 색으로 구분한다.
//
// 아래에는 7·30·100일 구간 보상이 있고, 이미 받은 것은 받은 날짜가 함께 보인다.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { format, useStreak } from '../../client';
import { Card, Icon, QueryState, Screen, SectionTitle } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

const STATUS_COLOR = {
  success: colors.success,
  failed: colors.danger,
  pending: colors.warning,
  none: colors.border,
  future: colors.background,
};

export default function StreakScreen({ navigation }) {
  const streak = useStreak();

  return (
    <Screen title="연속 달성" onBack={() => navigation.goBack()} padded={false}>
      <QueryState query={streak}>
        {(data) => (
          <ScrollView contentContainerStyle={styles.body}>
            <Card style={styles.hero}>
              <Icon name="flame" size={44} color={colors.warning} />
              <Text style={styles.days}>{data.currentDays}일</Text>
              <Text style={styles.label}>지금 연속 달성 중</Text>
              <Text style={styles.best}>최고 기록 {data.longestDays}일</Text>
              {!!data.lastSuccessDate && (
                <Text style={styles.best}>
                  마지막 성공 {format.formatDate(data.lastSuccessDate)}
                </Text>
              )}
            </Card>

            <View>
              <SectionTitle title="이번 주" />
              <Card>
                <View style={styles.week}>
                  {(data.week ?? []).map((day, index) => (
                    <View key={day.date} style={styles.dayCell}>
                      <Text style={styles.weekday}>{WEEKDAYS[index]}</Text>
                      <View
                        style={[styles.dayDot, { backgroundColor: STATUS_COLOR[day.status] }]}
                      />
                      <Text style={styles.dayNumber}>{Number(day.date.slice(8))}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            </View>

            <View>
              <SectionTitle title="구간 보상" />
              <Card style={styles.milestones}>
                {(data.milestones ?? []).map((milestone) => (
                  <View key={milestone.targetDays} style={styles.milestoneRow}>
                    <Icon
                      name={milestone.achieved ? 'check' : 'gift'}
                      size={18}
                      color={milestone.achieved ? colors.success : colors.textSub}
                      strokeWidth={milestone.achieved ? 2.4 : 1.8}
                    />
                    <View style={styles.milestoneTexts}>
                      <Text style={styles.milestoneTitle}>{milestone.targetDays}일 연속</Text>
                      <Text style={styles.milestoneMeta}>
                        {milestone.achieved && milestone.achievedDate
                          ? `${format.formatDate(milestone.achievedDate)} 받음`
                          : `${format.formatPoints(milestone.points)} 받을 수 있어요`}
                      </Text>
                    </View>
                  </View>
                ))}
              </Card>
            </View>
          </ScrollView>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', gap: spacing.xs },
  days: { ...typography.figure, color: colors.text },
  label: { ...typography.body, color: colors.textSub },
  best: { ...typography.caption, color: colors.textSub },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCell: { alignItems: 'center', gap: spacing.xs, flex: 1 },
  weekday: { ...typography.caption, color: colors.textSub },
  dayDot: { width: 26, height: 26, borderRadius: radius.full },
  dayNumber: { ...typography.caption, color: colors.textSub },
  milestones: { gap: spacing.md },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  milestoneTexts: { flex: 1, gap: 2 },
  milestoneTitle: { ...typography.body, color: colors.text },
  milestoneMeta: { ...typography.caption, color: colors.textSub },
});
