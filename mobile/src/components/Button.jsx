/**
 * 버튼.
 *
 * 네 가지 모양이 있다.
 *   primary    가장 중요한 동작 (파란 채움)
 *   secondary  보조 동작 (테두리만)
 *   danger     되돌리기 어려운 동작 (빨강)
 *   text       글자만 (취소·건너뛰기)
 *
 * `loading`이면 돌아가는 표시를 띄우고 눌리지 않는다 — 같은 요청이 두 번 나가지 않게 한다.
 *
 * @param {{
 *   title: string, onPress: () => void,
 *   variant?: 'primary'|'secondary'|'danger'|'text',
 *   loading?: boolean, disabled?: boolean, size?: 'md'|'sm', full?: boolean, icon?: string
 * }} props
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Icon from './Icon';
import { colors, radius, spacing, typography } from '../theme';

export default function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  size = 'md',
  full = false,
  icon,
}) {
  const inactive = disabled || loading;
  const tone = TONES[variant] ?? TONES.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={inactive}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: tone.background, borderColor: tone.border },
        full && styles.full,
        inactive && styles.inactive,
      ]}>
      {loading ? (
        <ActivityIndicator color={tone.label} size="small" />
      ) : (
        <View style={styles.row}>
          {!!icon && <Icon name={icon} size={18} color={tone.label} />}
          <Text style={[size === 'sm' ? typography.body : typography.bodyStrong, { color: tone.label }]}>
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const TONES = {
  primary: { background: colors.primary, border: colors.primary, label: '#FFFFFF' },
  secondary: { background: colors.surface, border: colors.border, label: colors.text },
  danger: { background: colors.danger, border: colors.danger, label: '#FFFFFF' },
  text: { background: 'transparent', border: 'transparent', label: colors.primary },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  md: { paddingVertical: 14, paddingHorizontal: spacing.xl },
  sm: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  full: { alignSelf: 'stretch' },
  inactive: { opacity: 0.45 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
