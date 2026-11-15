/**
 * 서로 배타적인 보기 몇 개 중 하나를 고르는 분리형 컨트롤.
 *
 * 기간(주간·월간·전체)처럼 '한 번에 하나만 보는' 선택에 쓴다. 칩 줄(OptionRow)과 달리
 * 한 덩어리로 보이고, 선택된 칸만 흰 면으로 올라온다.
 *
 * @param {{
 *   options: {value: string, label: string}[],
 *   value: string,
 *   onChange: (value: string) => void
 * }} props
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

export default function SegmentedControl({ options = [], value, onChange }) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.segmentSelected]}>
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.trackSoft,
    borderRadius: radius.full,
    padding: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  segmentSelected: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { ...typography.body, color: colors.textSub },
  labelSelected: { color: colors.primary, fontWeight: '600' },
});
