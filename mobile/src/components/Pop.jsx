/**
 * 보상 순간용 등장 연출.
 *
 *   rise   아래에서 올라오며 나타남 (카드)
 *   pop    작게 시작해 살짝 커졌다가 자리잡음 (배지·아이콘)
 *   bump   바로 보이다가 한 번 커졌다 돌아옴 (바뀐 펫)
 *
 * '동작 줄이기'가 켜져 있으면 연출 없이 그대로 보인다.
 *
 * @param {{kind?: 'rise'|'pop'|'bump', delay?: number, style?: any, children: React.ReactNode}} props
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

import useReduceMotion from '../hooks/useReduceMotion';

export default function Pop({ kind = 'pop', delay = 0, style, children }) {
  const reduce = useReduceMotion();
  const value = useRef(new Animated.Value(reduce ? 1 : 0)).current;

  useEffect(() => {
    if (reduce) {
      value.setValue(1);
      return undefined;
    }
    value.setValue(0);
    const run =
      kind === 'rise'
        ? Animated.timing(value, {
            toValue: 1,
            duration: 320,
            delay,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        : Animated.sequence([
            Animated.delay(delay),
            Animated.spring(value, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
          ]);
    run.start();
    return () => run.stop();
  }, [reduce, kind, delay, value]);

  let animated;
  if (kind === 'rise') {
    animated = {
      opacity: value,
      transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
    };
  } else if (kind === 'bump') {
    animated = {
      transform: [{ scale: value.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.85, 1.15, 1] }) }],
    };
  } else {
    animated = {
      opacity: value.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
      transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
    };
  }

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
