/**
 * 보기 몇 개 중 하나를 고르는 가로 줄.
 *
 * 분야·난이도·기간처럼 값이 서너 개뿐인 선택에 쓴다. 선택지는 서버에서 받은
 * 목록을 그대로 넘기고, 여기서는 고르는 동작과 보이는 모양만 맡는다.
 *
 * @param {{
 *   label?: string,
 *   options: {value: string, label: string}[],
 *   value: string|null,
 *   onChange: (value: string) => void,
 *   disabled?: boolean
 * }} props
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

export default function OptionRow({ label, options = [], value, onChange, disabled = false }) {
  return (
    <View style={styles.wrap}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.options}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => !disabled && onChange(option.value)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              style={[styles.option, selected && styles.optionSelected, disabled && styles.dim]}>
              <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { ...typography.caption, color: colors.textSub },
  options: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  option: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: '#EBF1FF' },
  dim: { opacity: 0.5 },
  optionLabel: { ...typography.body, color: colors.textSub },
  optionLabelSelected: { color: colors.primary, fontWeight: '600' },
});
