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

/** 글자만 있는 링크는 위아래를 넓혀 44dp 이상을 맞춘다 */
const LINK_HIT_SLOP = { top: 14, bottom: 14, left: 12, right: 12 };

export default function SectionTitle({ title, actionText, onAction }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {!!actionText && !!onAction && (
        <TouchableOpacity
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={`${title} ${actionText}`}
          hitSlop={LINK_HIT_SLOP}>
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
