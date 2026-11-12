/**
 * 메뉴·설정에서 쓰는 한 줄짜리 항목.
 *
 * 왼쪽 아이콘, 제목, 보조 설명, 오른쪽 값이나 화살표로 이루어진다.
 * 마이 화면의 메뉴 목록과 설정 화면이 같은 모양을 쓰도록 한 곳에 모았다.
 *
 * @param {{
 *   title: string, description?: string, icon?: string, value?: string,
 *   onPress?: () => void, right?: React.ReactNode, danger?: boolean
 * }} props
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Icon from './Icon';
import { colors, spacing, typography } from '../theme';

export default function ListRow({
  title,
  description,
  icon,
  value,
  onPress,
  right,
  danger = false,
}) {
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole={onPress ? 'button' : undefined}
      style={styles.row}>
      {!!icon && <Icon name={icon} size={20} color={danger ? colors.danger : colors.textSub} />}

      <View style={styles.texts}>
        <Text style={[styles.title, danger && styles.danger]}>{title}</Text>
        {!!description && <Text style={styles.description}>{description}</Text>}
      </View>

      {!!value && <Text style={styles.value}>{value}</Text>}
      {right}
      {!right && !!onPress && <Icon name="chevronRight" size={18} color={colors.border} />}
    </Container>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  texts: { flex: 1, gap: 2 },
  title: { ...typography.body, color: colors.text },
  danger: { color: colors.danger },
  description: { ...typography.caption, color: colors.textSub },
  value: { ...typography.caption, color: colors.textSub },
});
