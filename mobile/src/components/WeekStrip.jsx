/**
 * 홈 위쪽의 한 주 달력 띠.
 *
 * 월~일 7칸을 보여 주고, 각 칸 아래에 그날의 달성 정도를 작은 점으로 표시한다.
 * 다 한 날은 꽉 찬 점, 일부만 한 날은 옅은 점, 미션이 없던 날은 점 없음.
 * 오늘은 테두리로, 보고 있는 날짜는 채운 배경으로 구분한다.
 *
 * @param {{
 *   days: {date: string, completedCount: number, totalCount: number, isToday: boolean}[],
 *   selectedDate: string, onSelect: (date: string) => void
 * }} props
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 날짜 문자열에서 '일'과 요일 글자를 꺼낸다 (KST 고정). */
function parts(date) {
  const ms = Date.parse(`${date}T00:00:00+09:00`);
  const shifted = new Date(ms + 9 * 60 * 60 * 1000);
  return { day: shifted.getUTCDate(), weekday: WEEKDAYS[shifted.getUTCDay()] };
}

export default function WeekStrip({ days = [], selectedDate, onSelect }) {
  return (
    <View style={styles.row}>
      {days.map((day) => {
        const { day: dayNumber, weekday } = parts(day.date);
        const selected = day.date === selectedDate;
        const done = day.totalCount > 0 && day.completedCount >= day.totalCount;
        const partial = day.completedCount > 0 && !done;

        return (
          <TouchableOpacity
            key={day.date}
            onPress={() => onSelect?.(day.date)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={styles.cell}>
            <Text style={[styles.weekday, selected && styles.weekdaySelected]}>{weekday}</Text>
            <View
              style={[
                styles.dayBox,
                day.isToday && styles.dayBoxToday,
                selected && styles.dayBoxSelected,
              ]}>
              <Text style={[styles.dayNumber, selected && styles.dayNumberSelected]}>
                {dayNumber}
              </Text>
            </View>
            <View
              style={[
                styles.dot,
                done && styles.dotDone,
                partial && styles.dotPartial,
              ]}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  cell: { alignItems: 'center', gap: spacing.xs, flex: 1 },
  weekday: { ...typography.caption, color: colors.textSub },
  weekdaySelected: { color: colors.primary },
  dayBox: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayBoxToday: { borderColor: colors.primary },
  dayBoxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayNumber: { ...typography.body, color: colors.text },
  dayNumberSelected: { color: '#FFFFFF', fontWeight: '600' },
  dot: { width: 5, height: 5, borderRadius: radius.full, backgroundColor: 'transparent' },
  dotDone: { backgroundColor: colors.success },
  dotPartial: { backgroundColor: colors.border },
});
