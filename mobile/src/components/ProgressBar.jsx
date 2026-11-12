/**
 * 가로 진행 막대.
 *
 * 0~1 사이 비율을 받아 채워진 길이로 보여 준다. 범위를 벗어난 값이 와도
 * 0~1로 잘라서 막대가 상자 밖으로 나가지 않게 한다.
 *
 * @param {{rate: number, color?: string, height?: number, label?: string}} props
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

export default function ProgressBar({ rate, color = colors.primary, height = 8, label }) {
  const clamped = Math.max(0, Math.min(1, Number(rate) || 0));

  return (
    <View style={styles.wrap}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        <View
          style={[
            styles.fill,
            { width: `${clamped * 100}%`, backgroundColor: color, borderRadius: height / 2 },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { ...typography.caption, color: colors.textSub },
  track: { backgroundColor: colors.border, overflow: 'hidden', width: '100%' },
  fill: { height: '100%' },
});
