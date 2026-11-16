/**
 * 앱을 보고 있는 동안 도착한 푸시를 화면 위쪽 띠로 잠깐 보여 준다.
 *
 * Android는 앱이 앞에 떠 있으면 푸시를 알림창에 띄우지 않고 앱에 넘긴다.
 * 그 푸시를 4초 동안 보여 주고, 누르면 `onPress`(알림이 가리키는 화면으로 이동)를 부른다.
 * 새 푸시가 오면 앞의 것을 바꿔 끼운다.
 *
 * @param {{
 *   notice: {id: number, title: string, body: string} | null,
 *   onPress: () => void,
 *   onClose: () => void,
 * }} props
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from './Icon';
import useReduceMotion from '../hooks/useReduceMotion';
import { colors, radius, spacing, typography } from '../theme';

const VISIBLE_MS = 4000;

export default function InAppNotice({ notice, onPress, onClose }) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!notice) return undefined;
    slide.setValue(reduceMotion ? 1 : 0);
    if (!reduceMotion) {
      Animated.timing(slide, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    }
    const timer = setTimeout(onClose, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [notice, onClose, reduceMotion, slide]);

  if (!notice) return null;

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [-120, 0] });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.layer, { paddingTop: insets.top + spacing.sm, transform: [{ translateY }] }]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${notice.title}. ${notice.body}`}
        accessibilityHint="눌러서 알림 내용을 열어요"
        style={styles.card}>
        <View style={styles.icon}>
          <Icon name="bell" size={18} color={colors.primary} />
        </View>
        <View style={styles.texts}>
          {!!notice.title && (
            <Text style={styles.title} numberOfLines={1}>
              {notice.title}
            </Text>
          )}
          {!!notice.body && (
            <Text style={styles.body} numberOfLines={2}>
              {notice.body}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="알림 닫기"
          hitSlop={10}>
          <Icon name="close" size={16} color={colors.textSub} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    zIndex: 1000,
    elevation: 1000,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  texts: { flex: 1, gap: 2 },
  title: { ...typography.bodyStrong, color: colors.text },
  body: { ...typography.caption, color: colors.textSub },
});
