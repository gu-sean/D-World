/**
 * 날짜 하나를 고르는 입력칸.
 *
 * `YYYY-MM-DD` 문자열을 직접 치거나, 아래 칩으로 하루·일주일씩 옮길 수 있다.
 * 서버와 주고받는 값이 그대로 이 형식이라 변환할 일이 없고, 네이티브 달력
 * 라이브러리를 더 넣지 않아도 된다.
 *
 * 고른 날짜는 한국 시간 기준으로 "11월 4일 (수)"처럼 함께 보여 준다.
 *
 * @param {{
 *   label?: string, value: string, onChange: (date: string) => void,
 *   error?: string|null, min?: string, max?: string, quick?: boolean
 * }} props
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import TextField from './TextField';
import { format } from '../client';
import { colors, radius, spacing, typography } from '../theme';

const DAY_MS = 86400000;

/** `YYYY-MM-DD`에 일수를 더한 값. 잘못된 값이면 오늘 기준으로 센다. */
function shift(date, days) {
  const base = Date.parse(`${date}T00:00:00+09:00`);
  const from = Number.isNaN(base) ? Date.now() : base;
  return format.toDateString(from + days * DAY_MS);
}

const QUICK = [
  { label: '오늘', days: 0, absolute: true },
  { label: '내일', days: 1, absolute: true },
  { label: '+1주', days: 7 },
  { label: '+1개월', days: 30 },
];

export default function DateField({ label, value, onChange, error, min, max, quick = true }) {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(value ?? '');

  const apply = (item) => {
    const next = item.absolute
      ? shift(format.todayKst(), item.days)
      : shift(valid ? value : format.todayKst(), item.days);
    if (min && next < min) return onChange(min);
    if (max && next > max) return onChange(max);
    return onChange(next);
  };

  return (
    <View style={styles.wrap}>
      <TextField
        label={label}
        value={value}
        onChangeText={(text) => onChange(text.replace(/[^\d-]/g, '').slice(0, 10))}
        placeholder="2026-11-04"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        error={error}
        hint={valid ? format.formatDate(value) : '연-월-일 순서로 입력해 주세요'}
      />

      {quick && (
        <View style={styles.chips}>
          {QUICK.map((item) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => apply(item)}
              accessibilityRole="button"
              style={styles.chip}>
              <Text style={styles.chipLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipLabel: { ...typography.caption, color: colors.textSub },
});
