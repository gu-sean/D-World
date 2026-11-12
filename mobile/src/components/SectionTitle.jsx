/**
 * 화면 안 구역의 제목 줄.
 *
 * 왼쪽에 제목, 오른쪽에 "더 보기" 같은 동작을 둘 수 있다.
 *
 * @param {{title: string, actionText?: string, onAction?: () => void}} props
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, spacing, typography } from '../theme';

export default function SectionTitle({ title, actionText, onAction }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {!!actionText && !!onAction && (
        <TouchableOpacity onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.action}>{actionText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: { ...typography.subtitle, color: colors.text },
  action: { ...typography.caption, color: colors.primary },
});
