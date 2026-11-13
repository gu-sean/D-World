/**
 * 목표 분야를 나타내는 칩.
 *
 * 이름은 서버가 준 값을 쓰고, 색과 아이콘만 `theme/categoryStyle.js`에서 찾는다.
 * 목표·미션·펫 응답은 분야 코드만 주므로, `name`이 없으면 서버의 분야 목록(A17 `GoalCategory.name`,
 * 한 번 받으면 계속 캐시)에서 코드로 이름을 찾는다. 목록에 없으면 마지막으로 코드를 보여 준다.
 *
 * @param {{categoryCode: string, name?: string, size?: 'md'|'sm'}} props
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useGoalCategories } from '../client';
import Icon from './Icon';
import { categoryStyle, radius, spacing, typography } from '../theme';

export default function CategoryChip({ categoryCode, name, size = 'md' }) {
  const style = categoryStyle(categoryCode);
  const categories = useGoalCategories();
  const label =
    name ?? (categories.data ?? []).find((c) => c.code === categoryCode)?.name ?? categoryCode;

  return (
    <View style={[styles.chip, { backgroundColor: style.tint }, size === 'sm' && styles.chipSm]}>
      <Icon name={style.icon} size={size === 'sm' ? 12 : 14} color={style.color} strokeWidth={2} />
      <Text style={[styles.label, { color: style.color }]}>{label}</Text>
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
