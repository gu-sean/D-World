/**
 * 목표 분야를 나타내는 칩.
 *
 * 이름은 서버가 준 값(`GoalCategory.name` 또는 미션의 분야 이름)을 그대로 쓰고,
 * 색과 아이콘만 `theme/categoryStyle.js`에서 찾는다. 이름이 없으면 코드를 보여 준다.
 *
 * @param {{categoryCode: string, name?: string, size?: 'md'|'sm'}} props
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Icon from './Icon';
import { categoryStyle, radius, spacing, typography } from '../theme';

export default function CategoryChip({ categoryCode, name, size = 'md' }) {
  const style = categoryStyle(categoryCode);

  return (
    <View style={[styles.chip, { backgroundColor: style.tint }, size === 'sm' && styles.chipSm]}>
      <Icon name={style.icon} size={size === 'sm' ? 12 : 14} color={style.color} strokeWidth={2} />
      <Text style={[styles.label, { color: style.color }]}>{name ?? categoryCode}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  chipSm: { paddingVertical: 2, paddingHorizontal: 6 },
  label: { ...typography.caption, fontWeight: '600' },
});
