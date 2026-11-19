/**
 * 한 달 동안 날마다 얼마나 달성했는지를 칸 색 진하기로 보여 주는 잔디형 달력(히트맵).
 *
 * 리포트 '월간' 탭에서 쓴다. 숫자는 달력 API(A64 `CalendarDay[]`)의 `completedCount`·`totalCount`를
 * 그대로 쓰고, 달성률(완료 / 계획)을 4단계로 나눠 진하게 칠한다. 계획한 미션이 없는 날은
 * 회색, 오늘 이후는 흐린 빈칸이다. 오늘까지의 칸을 누르면 그 날 완료한 미션 창이 뜬다.
 *
 * @param {{
 *   month: string,
 *   onMissionPress?: (mission: object) => void
 * }} props `month`는 `YYYY-MM`. 창에서 미션을 누르면 `onMissionPress`로 넘긴다
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import DayMissionsDialog from './DayMissionsDialog';
import { format, useCalendar } from '../client';
import { colors, radius, spacing, typography } from '../theme';

/** 일요일부터 시작하는 일반 달력 순서 */
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 달성률 단계별 칸 색. 주 색(colors.primary #4F7CFF)을 진하기만 달리 했다 — 주 색을 바꾸면 함께 바꾼다.
 * 0: 계획은 있었지만 하나도 못 함, 4: 모두 완료
 */
const HEAT_COLORS = [
  'rgba(79, 124, 255, 0.08)',
  'rgba(79, 124, 255, 0.28)',
  'rgba(79, 124, 255, 0.5)',
  'rgba(79, 124, 255, 0.75)',
  colors.primary,
];

/** 완료/계획을 0~4 단계로 나눈다 */
function heatLevel(completed, total) {
  if (total === 0 || completed === 0) return 0;
  if (completed >= total) return 4;
  const rate = completed / total;
  if (rate < 1 / 3) return 1;
  if (rate < 2 / 3) return 2;
  return 3;
}

/** `YYYY-MM-DD`의 요일 칸 위치 (일=0 … 토=6) */
function weekdayIndex(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export default function MonthlyHeatmap({ month, onMissionPress }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const calendar = useCalendar(month);
  const today = format.todayKst();

  const days = (calendar.data ?? []).map((day) => ({
    ...day,
    isToday: day.date === today,
    isFuture: day.date > today,
  }));
  const fullDays = days.filter(
    (day) => !day.isFuture && day.totalCount > 0 && day.completedCount >= day.totalCount,
  ).length;

  // 1일 앞을 빈칸으로 채워 요일 열을 맞추고, 끝도 7칸 단위로 맞춘다
  const leading = days.length > 0 ? weekdayIndex(days[0].date) : 0;
  const cells = [...Array(leading).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>날짜별 달성</Text>
        {calendar.isSuccess && (
          <Text style={styles.total}>모두 완료한 날 {format.formatNumber(fullDays)}일</Text>
        )}
      </View>

      {calendar.isError ? (
        <Text style={styles.message}>달력을 불러오지 못했어요. 아래로 당겨 새로고침해 주세요.</Text>
      ) : (
        <>
          <View style={styles.row}>
            {WEEKDAYS.map((label) => (
              <Text key={label} style={styles.weekday}>
                {label}
              </Text>
            ))}
          </View>

          {calendar.isLoading ? (
            <View style={styles.loading} />
          ) : (
            weeks.map((week, weekIndex) => (
              <View key={weekIndex} style={styles.row}>
                {week.map((day, dayIndex) => {
                  if (!day) return <View key={`blank-${dayIndex}`} style={styles.cell} />;

                  const level = heatLevel(day.completedCount, day.totalCount);
                  const noPlan = day.totalCount === 0;
                  const dayNumber = Number(day.date.slice(8));
                  return (
                    <TouchableOpacity
                      key={day.date}
                      disabled={day.isFuture}
                      onPress={() => setSelectedDate(day.date)}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: day.isFuture }}
                      accessibilityLabel={
                        day.isFuture
                          ? `${dayNumber}일`
                          : `${dayNumber}일 ${day.totalCount}개 중 ${day.completedCount}개 완료, 눌러서 완료한 미션 보기`
                      }
                      style={[
                        styles.cell,
                        styles.square,
                        day.isFuture
                          ? styles.squareFuture
                          : noPlan
                          ? styles.squareNoPlan
                          : { backgroundColor: HEAT_COLORS[level] },
                        day.isToday && styles.squareToday,
                      ]}>
                      <Text
                        style={[
                          styles.dayNumber,
                          level >= 3 && !day.isFuture && styles.dayNumberOnDark,
                          day.isFuture && styles.dayNumberFuture,
                        ]}>
                        {dayNumber}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )}

          <View style={styles.legend}>
            <View style={styles.legendGroup}>
              <View style={[styles.legendBox, styles.squareNoPlan]} />
              <Text style={styles.legendText}>미션 없음</Text>
            </View>
            <View style={styles.legendGroup}>
              <Text style={styles.legendText}>적게</Text>
              {HEAT_COLORS.map((color) => (
                <View key={color} style={[styles.legendBox, { backgroundColor: color }]} />
              ))}
              <Text style={styles.legendText}>모두 완료</Text>
            </View>
          </View>
        </>
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
  wrap: { gap: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { ...typography.bodyStrong, color: colors.text },
  total: { ...typography.caption, color: colors.textSub },
  message: { ...typography.caption, color: colors.textSub },
  row: { flexDirection: 'row', gap: spacing.xs },
  weekday: { flex: 1, textAlign: 'center', ...typography.caption, color: colors.textSub },
  loading: { height: 220, borderRadius: radius.md, backgroundColor: colors.neutralSoft },
  cell: { flex: 1, aspectRatio: 1 },
  // 오늘 칸 테두리 때문에 칸 크기가 달라지지 않도록 모든 칸에 같은 두께의 투명 테두리를 둔다
  square: {
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  squareNoPlan: { backgroundColor: colors.trackSoft },
  squareFuture: { backgroundColor: colors.neutralSoft, opacity: 0.6 },
  squareToday: { borderColor: colors.primaryDark },
  dayNumber: { ...typography.caption, fontSize: 12, color: colors.text },
  dayNumberOnDark: { color: colors.onPrimary, fontWeight: '600' },
  dayNumberFuture: { color: colors.textSub },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  legendGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendBox: { width: 12, height: 12, borderRadius: 3 },
  legendText: { ...typography.caption, fontSize: 11, color: colors.textSub },
});
