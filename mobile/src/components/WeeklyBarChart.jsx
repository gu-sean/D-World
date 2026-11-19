/**
 * 한 주(월~일) 동안 날마다 완료한 미션 수를 세로 막대로 보여 주는 그래프.
 *
 * 리포트 '주간' 탭에서 쓴다. 숫자는 달력 API(A64 `CalendarDay[]`)의 `completedCount`를
 * 그대로 쓰고, 막대 높이는 하루 5개 완료를 꽉 찬 높이로 잡아 비례로 그린다(5개 넘으면 꽉 찬 채로).
 * 오늘 이후 날짜는 아직 완료가 없으므로 0으로 보여 주고 흐리게 그린다.
 * 한 주가 두 달에 걸치면 두 달을 각각 조회해 이어 붙인다.
 * 오늘까지의 막대를 누르면 그 날 완료한 미션 목록 창(DayMissionsDialog)이 뜬다.
 *
 * @param {{
 *   startDate: string,
 *   endDate: string,
 *   onMissionPress?: (mission: object) => void
 * }} props 날짜는 `YYYY-MM-DD` (월요일, 일요일). 창에서 미션을 누르면 `onMissionPress`로 넘긴다
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import DayMissionsDialog from './DayMissionsDialog';
import { format, useCalendar } from '../client';
import { colors, radius, spacing, typography } from '../theme';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const BAR_AREA_HEIGHT = 120;
/** 완료가 0인 날도 자리가 보이도록 남기는 최소 높이 */
const MIN_BAR_HEIGHT = 4;
/** 하루에 이만큼 완료하면 막대가 꽉 찬다 */
const FULL_BAR_COUNT = 5;

/** `YYYY-MM-DD`에 날짜를 더한다 (시간대 영향 없이 UTC로 계산) */
function addDays(dateString, days) {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export default function WeeklyBarChart({ startDate, endDate, onMissionPress }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const startMonth = startDate?.slice(0, 7);
  const endMonth = endDate?.slice(0, 7);
  const first = useCalendar(startMonth);
  // 같은 달이면 같은 조회를 한 번 더 부르지 않는다
  const second = useCalendar(endMonth !== startMonth ? endMonth : null);

  const loading = first.isLoading || (endMonth !== startMonth && second.isLoading);
  const failed = first.isError || second.isError;

  const byDate = new Map(
    [...(first.data ?? []), ...(second.data ?? [])].map((day) => [day.date, day]),
  );
  const today = format.todayKst();
  const days = WEEKDAYS.map((label, index) => {
    const date = addDays(startDate, index);
    return {
      date,
      label,
      completed: byDate.get(date)?.completedCount ?? 0,
      isToday: date === today,
      isFuture: date > today,
    };
  });
  const total = days.reduce((sum, day) => sum + day.completed, 0);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>요일별 완료</Text>
        {!loading && !failed && (
          <Text style={styles.total}>이번 주 {format.formatNumber(total)}개 완료</Text>
        )}
      </View>

      {failed ? (
        <Text style={styles.message}>
          그래프를 불러오지 못했어요. 아래로 당겨 새로고침해 주세요.
        </Text>
      ) : (
        <View style={styles.chart}>
          {days.map((day) => {
            const height = loading
              ? MIN_BAR_HEIGHT
              : Math.max(
                  MIN_BAR_HEIGHT,
                  (Math.min(day.completed, FULL_BAR_COUNT) / FULL_BAR_COUNT) * BAR_AREA_HEIGHT,
                );
            const pressable = !loading && !day.isFuture;
            return (
              <TouchableOpacity
                key={day.date}
                style={styles.column}
                disabled={!pressable}
                onPress={() => setSelectedDate(day.date)}
                accessibilityRole="button"
                accessibilityState={{ disabled: !pressable }}
                accessibilityLabel={`${day.label}요일 ${day.isFuture ? 0 : day.completed}개 완료${
                  pressable ? ', 눌러서 완료한 미션 보기' : ''
                }`}>
                <Text style={[styles.count, day.completed === 0 && styles.countZero]}>
                  {loading ? '' : day.isFuture ? 0 : day.completed}
                </Text>
                <View style={styles.barArea}>
                  <View
                    style={[
                      styles.bar,
                      { height },
                      day.completed > 0 ? styles.barFilled : styles.barEmpty,
                      day.isToday && day.completed > 0 && styles.barToday,
                      day.isFuture && styles.barFuture,
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.day,
                    day.isToday && styles.dayToday,
                    day.isFuture && styles.dayFuture,
                  ]}>
                  {day.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <DayMissionsDialog
        date={selectedDate}
        onClose={() => setSelectedDate(null)}
        onMissionPress={
          onMissionPress
            ? (mission) => {
                setSelectedDate(null);
                onMissionPress(mission);
              }
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { ...typography.bodyStrong, color: colors.text },
  total: { ...typography.caption, color: colors.textSub },
  message: { ...typography.caption, color: colors.textSub },
  chart: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  column: { flex: 1, alignItems: 'center', gap: spacing.xs },
  count: { ...typography.caption, color: colors.text, fontWeight: '600', minHeight: 18 },
  countZero: { color: colors.textSub, fontWeight: '400' },
  barArea: {
    height: BAR_AREA_HEIGHT,
    justifyContent: 'flex-end',
    width: '100%',
    alignItems: 'center',
  },
  bar: { width: '60%', maxWidth: 28, borderRadius: radius.sm },
  barFilled: { backgroundColor: colors.primary },
  barEmpty: { backgroundColor: colors.trackSoft },
  barToday: { backgroundColor: colors.primaryDark },
  barFuture: { opacity: 0.5 },
  day: { ...typography.caption, color: colors.textSub },
  dayToday: { color: colors.primary, fontWeight: '600' },
  dayFuture: { opacity: 0.6 },
});
