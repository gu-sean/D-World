/**
 * 폼 제출이 실패했을 때 위쪽에 띄우는 빨간 띠.
 *
 * 서버가 준 문장을 그대로 보여 준다. 앱이 문구를 지어내지 않기 때문에
 * 오류 코드가 바뀌어도 화면은 손대지 않아도 된다. `error`가 없으면 아무것도 그리지 않는다.
 *
 * @param {{error?: {message?: string}|null, onClose?: () => void}} props
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Icon from './Icon';
import { colors, radius, spacing, typography } from '../theme';

export default function ErrorBanner({ error, onClose }) {
  if (!error) return null;

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <Icon name="alert" size={18} color={colors.danger} />
      <Text style={styles.message}>{error.message ?? '잠시 후 다시 시도해 주세요.'}</Text>
      {!!onClose && (
        <TouchableOpacity onPress={onClose} accessibilityRole="button" hitSlop={8}>
          <Icon name="close" size={16} color={colors.danger} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  message: { flex: 1, ...typography.caption, color: colors.danger },
});
