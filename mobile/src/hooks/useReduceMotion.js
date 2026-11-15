import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** 기기의 '동작 줄이기' 설정이 켜져 있는지. 켜져 있으면 연출을 건너뛴다. */
export default function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => alive && setReduce(value))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}
