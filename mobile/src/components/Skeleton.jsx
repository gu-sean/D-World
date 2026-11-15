/**
 * 로딩 중에 보여 주는 회색 틀(스켈레톤).
 *
 * `Skeleton`으로 감싼 `Bone`(회색 막대·원)들 위로 밝은 띠가 천천히 지나간다.
 * 기기의 '동작 줄이기' 설정이 켜져 있으면 띠 없이 정지된 틀만 보여 준다.
 *
 * @param {{children: React.ReactNode, style?: any}} props
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import useReduceMotion from '../hooks/useReduceMotion';
import { colors } from '../theme';

const BAND_WIDTH = 120;

/** 회색 막대(또는 원). width는 숫자(dp)나 '60%' 같은 문자열 */
export function Bone({ width = '100%', height = 14, round, style }) {
  return (
    <View
      style={[
        styles.bone,
        { width, height, borderRadius: round ? height / 2 : Math.min(height / 2, 8) },
        style,
      ]}
    />
  );
}

export default function Skeleton({ children, style }) {
  const sweep = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion || width === 0) return undefined;
    const loop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, width, sweep]);

  const translateX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-BAND_WIDTH, width + BAND_WIDTH],
  });

  return (
    <View
      style={[styles.group, style]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="불러오는 중">
      {children}
      {!reduceMotion && width > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.band, { transform: [{ translateX }, { skewX: '-20deg' }] }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { overflow: 'hidden' },
  bone: { backgroundColor: colors.trackSoft },
  band: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: BAND_WIDTH,
    backgroundColor: colors.shimmer,
  },
});
