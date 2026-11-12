// REPORT-02 월별 달력
//
// 한 달을 격자로 펼쳐 날마다 연속 달성 상태를 색으로 보여 준다.
// 날짜를 누르면 그날 완료한 미션 목록이 아래에 펼쳐진다.
//
// 상태는 서버가 준 값 그대로다 — 성공·실패·판정 대기·기록 없음·앞으로의 날.
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { format, useCalendar } from '../../client';
import { Card, Icon, QueryState, Screen, SectionTitle } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

const STATUS_COLOR = {
  success: colors.success,
  failed: colors.danger,
  pending: colors.warning,
  none: colors.border,
  future: 'transparent',
};

/** 이번 달 1일이 무슨 요일인지 보고 앞에 빈 칸을 몇 개 둘지 정한다 (월요일 시작). */
function leadingBlanks(firstDate) {
  const ms = Date.parse(`${firstDate}T00:00:00+09:00`);
  const weekday = new Date(ms + 9 * 3600000).getUTCDay();
  return weekday === 0 ? 6 : weekday - 1;
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
  const days = calendar.data ?? [];

  const pickedDay = useMemo(() => days.find((d) => d.date === picked) ?? null, [days, picked]);

  return (
    <Screen title="월별 기록" onBack={() => navigation.goBack()} padded={false}>
      <View style={styles.monthBar}>
        <TouchableOpacity onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={8}>
          <Icon name="chevronLeft" size={22} color={colors.textSub} />
        </TouchableOpacity>
        <Text style={styles.month}>{month.replace('-', '년 ')}월</Text>
        <TouchableOpacity onPress={() => setMonth(shiftMonth(month, 1))} hitSlop={8}>
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

              <View style={styles.grid}>
                {Array.from({ length: leadingBlanks(data[0].date) }).map((_, index) => (
                  <View key={`blank-${index}`} style={styles.cell} />
                ))}

                {data.map((day) => {
                  const selected = day.date === picked;
                  return (
                    <TouchableOpacity
                      key={day.date}
                      style={styles.cell}
                      onPress={() => setPicked(selected ? null : day.date)}
                      accessibilityRole="button">
                      <View style={[styles.dayBox, selected && styles.dayBoxSelected]}>
                        <Text style={[styles.dayNumber, selected && styles.dayNumberSelected]}>
                          {Number(day.date.slice(8))}
                        </Text>
                      </View>
                      <View
                        style={[styles.dot, { backgroundColor: STATUS_COLOR[day.status] }]}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.legend}>
                <Legend color={colors.success} label="성공" />
                <Legend color={colors.danger} label="실패" />
                <Legend color={colors.warning} label="대기" />
                <Legend color={colors.border} label="기록 없음" />
              </View>
            </Card>

            {!!pickedDay && (
              <View>
                <SectionTitle title={format.formatDate(pickedDay.date)} />
                <Card style={styles.dayCard}>
                  {pickedDay.completedMissions.length === 0 ? (
                    <Text style={styles.empty}>완료한 미션이 없어요.</Text>
                  ) : (
                    pickedDay.completedMissions.map((mission) => (
                      <View key={mission.missionId} style={styles.missionRow}>
                        <Icon name="check" size={14} color={colors.success} strokeWidth={2.4} />
                        <Text style={styles.missionTitle}>{mission.title}</Text>
                      </View>
                    ))
                  )}
                </Card>
              </View>
            )}
          </ScrollView>
        )}
      </QueryState>
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
  weekday: { ...typography.caption, color: colors.textSub, width: `${100 / 7}%`, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: spacing.xs, gap: 3 },
  dayBox: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBoxSelected: { backgroundColor: colors.primary },
  dayNumber: { ...typography.caption, color: colors.text },
  dayNumberSelected: { color: '#FFFFFF', fontWeight: '600' },
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
  dayCard: { gap: spacing.sm },
  empty: { ...typography.caption, color: colors.textSub },
  missionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  missionTitle: { ...typography.body, color: colors.text, flex: 1 },
});
