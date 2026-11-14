/**
 * 동그란 진행 표시.
 *
 * 원 둘레를 따라 비율만큼 색을 채운다. 가운데에는 퍼센트를 보여 주거나
 * `children`으로 원하는 내용을 넣을 수 있다. 홈의 오늘 진행률에 쓴다.
 *
 * @param {{
 *   rate: number, size?: number, thickness?: number,
 *   color?: string, children?: React.ReactNode
 * }} props
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors, typography } from '../theme';

export default function ProgressRing({
  rate,
  size = 92,
  thickness = 9,
  color = colors.primary,
  children,
}) {
  const clamped = Math.max(0, Math.min(1, Number(rate) || 0));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={thickness}
          fill="none"
        />
        {/* 0%일 때 둥근 선 끝이 점 하나로 보이지 않게 아예 그리지 않는다 */}
        {clamped > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={thickness}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - clamped)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <View style={styles.center}>
        {children ?? (
          <Text
            style={[styles.percent, size < 72 && styles.percentSmall]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {Math.round(clamped * 100)}%
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // RN 0.86에는 StyleSheet.absoluteFillObject가 없어서 직접 겹쳐 놓는다 (없으면 %가 원 아래로 밀려남)
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percent: { ...typography.subtitle, color: colors.text },
  percentSmall: { ...typography.caption, fontWeight: '700', color: colors.text },
});
