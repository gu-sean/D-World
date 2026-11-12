/**
 * 보여 줄 내용이 없을 때의 안내.
 *
 * 목록이 비었거나 아직 만든 것이 없을 때 쓴다. `action`을 주면 아래에 버튼이 붙어
 * 바로 만들러 갈 수 있다.
 *
 * @param {{title: string, description?: string, icon?: string, action?: React.ReactNode}} props
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Icon from './Icon';
import { colors, spacing, typography } from '../theme';

export default function EmptyState({ title, description, icon = 'dot', action }) {
  return (
    <View style={styles.wrap}>
      <Icon name={icon} size={30} color={colors.border} />
      <Text style={styles.title}>{title}</Text>
      {!!description && <Text style={styles.description}>{description}</Text>}
      {!!action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  title: { ...typography.bodyStrong, color: colors.text, textAlign: 'center' },
  description: { ...typography.caption, color: colors.textSub, textAlign: 'center' },
  action: { marginTop: spacing.md },
});
