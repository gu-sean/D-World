// REPORT-02 월별 달력
//
// 한 달을 격자로 펼쳐 날마다 연속 달성 상태를 색으로 보여 준다 (일요일 시작).
// 날짜를 누르면 그날 완료한 미션 창(DayMissionsDialog)이 뜬다.
//
// 상태는 서버(A64 CalendarDay)의 streakStatus 그대로다 — 성공·실패·판정 대기, 값이 없으면 기록 없음.
// 오늘 이후 날짜는 점을 그리지 않고 누를 수 없다.
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { format, useCalendar } from '../../client';
import { Card, DayMissionsDialog, Icon, QueryState, Screen } from '../../components';
import Routes from '../../navigation/routes';
import { colors, radius, spacing, typography } from '../../theme';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const STATUS_COLOR = {
  success: colors.success,
  failed: colors.danger,
  pending: colors.warning,
  none: colors.border,
  future: 'transparent',
};

/**
 * 이번 달 1일이 무슨 요일인지 보고 앞에 빈 칸을 몇 개 둘지 정한다 (일요일 시작: 일=0 … 토=6).
 * `YYYY-MM-DD`를 숫자로 나눠 UTC로 계산한다 — 시간대가 붙은 날짜 문자열은 앱(Hermes)에서
 * 읽지 못해 빈 칸이 0개가 되고 날짜가 요일과 어긋났었다.
 */
function leadingBlanks(firstDate) {
  const [y, m, d] = firstDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** 칸 배열을 7칸씩 끊어 주(줄)로 만든다. 마지막 주도 7칸을 채워 열이 어긋나지 않게 한다. */
function toWeeks(cells) {
  const padded = [...cells];
  while (padded.length % 7 !== 0) padded.push(null);
  const weeks = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));
  return weeks;
}

function shiftMonth(month, delta) {
  const [year, m] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, m - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function MonthlyCalendarScreen({ navigation, route }) {
  const [month, setMonth] = useState(route.params?.month ?? format.todayKst().slice(0, 7));
  const [picked, setPicked] = useState(null);

  const calendar = useCalendar(month);
  const today = format.todayKst();

  const weeks = useMemo(() => {
    const days = calendar.data ?? [];
    if (days.length === 0) return [];
    return toWeeks([...Array(leadingBlanks(days[0].date)).fill(null), ...days]);
  }, [calendar.data]);

  return (
    <Screen title="월별 기록" onBack={() => navigation.goBack()} padded={false}>
      <View style={styles.monthBar}>
        <TouchableOpacity
          onPress={() => setMonth(shiftMonth(month, -1))}
          accessibilityRole="button"
          accessibilityLabel="이전 달"
          hitSlop={8}>
          <Icon name="chevronLeft" size={22} color={colors.textSub} />
        </TouchableOpacity>
        <Text style={styles.month}>{month.replace('-', '년 ')}월</Text>
        <TouchableOpacity
          onPress={() => setMonth(shiftMonth(month, 1))}
          accessibilityRole="button"
          accessibilityLabel="다음 달"
          hitSlop={8}>
          <Icon name="chevronRight" size={22} color={colors.textSub} />
        </TouchableOpacity>
      </View>

      <QueryState query={calendar} emptyTitle="이 달의 기록이 없어요">
        {(data) => (
          <ScrollView contentContainerStyle={styles.body}>
            <Card>
              <View style={styles.weekdays}>
                {WEEKDAYS.map((label) => (
                  <Text key={label} style={styles.weekday}>
                    {label}
                  </Text>
                ))}
              </View>

              {weeks.map((week, weekIndex) => (
                <View key={`week-${weekIndex}`} style={styles.week}>
                  {week.map((day, dayIndex) => {
                    if (!day) return <View key={`blank-${dayIndex}`} style={styles.cell} />;
                    const future = day.date > today;
                    const status = future ? 'future' : day.streakStatus ?? 'none';
                    const isToday = day.date === today;
                    const selected = day.date === picked;
                    const dayNumber = Number(day.date.slice(8));
                    return (
                      <TouchableOpacity
                        key={day.date}
                        style={styles.cell}
                        disabled={future}
                        onPress={() => setPicked(day.date)}
                        accessibilityRole="button"
                        accessibilityLabel={`${dayNumber}일`}
                        accessibilityState={{ selected, disabled: future }}>
                        <View
                          style={[
                            styles.dayBox,
                            isToday && styles.dayBoxToday,
                            selected && styles.dayBoxSelected,
                          ]}>
                          <Text
                            style={[
                              styles.dayNumber,
                              future && styles.dayNumberFuture,
                              selected && styles.dayNumberSelected,
                            ]}>
                            {dayNumber}
                          </Text>
                        </View>
                        <View style={[styles.dot, { backgroundColor: STATUS_COLOR[status] }]} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}

              <View style={styles.legend}>
                <Legend color={colors.success} label="성공" />
                <Legend color={colors.danger} label="실패" />
                <Legend color={colors.warning} label="대기" />
                <Legend color={colors.border} label="기록 없음" />
              </View>
            </Card>
          </ScrollView>
        )}
      </QueryState>

      <DayMissionsDialog
        date={picked}
        onClose={() => setPicked(null)}
        onMissionPress={(mission) => {
          setPicked(null);
          navigation.navigate(Routes.MISSION_DETAIL, { missionId: mission.id });
        }}
      />
    </Screen>
  );
}

function Legend({ color, label }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  month: { ...typography.bodyStrong, color: colors.text },
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  weekdays: { flexDirection: 'row', marginBottom: spacing.sm },
  weekday: {
    ...typography.caption,
    color: colors.textSub,
    flex: 1,
    textAlign: 'center',
  },
  // 한 주를 한 줄로 그리고 칸은 flex: 1로 나눈다 (100/7% 너비는 반올림 때문에 6칸에서 줄이 넘어갔었다)
  week: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs, gap: 3 },
  dayBox: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBoxToday: { borderWidth: 1.5, borderColor: colors.primary },
  dayBoxSelected: { backgroundColor: colors.primary },
  dayNumber: { ...typography.caption, color: colors.text },
  dayNumberFuture: { color: colors.textSub },
  dayNumberSelected: { color: colors.onPrimary, fontWeight: '600' },
  dot: { width: 6, height: 6, borderRadius: radius.full },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
    justifyContent: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendLabel: { ...typography.caption, color: colors.textSub },
});
