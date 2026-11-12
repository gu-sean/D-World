/**
 * 흰 바탕의 카드 상자.
 *
 * 목록 항목·요약 블록처럼 바탕 위에 떠 있는 덩어리를 감싼다.
 * `onPress`를 주면 눌리는 카드가 되고, 주지 않으면 그냥 상자다.
 *
 * @param {{onPress?: () => void, style?: any, children: React.ReactNode}} props
 */
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { colors, radius, spacing } from '../theme';

export default function Card({ onPress, style, children }) {
  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        style={[styles.card, style]}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
});
