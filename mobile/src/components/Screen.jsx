/**
 * 모든 화면의 바깥 틀.
 *
 * 노치·홈 인디케이터를 피한 여백을 잡고, 바탕색을 깔고, 머리글을 그린다.
 * `scroll`을 켜면 내용이 길어질 때 스크롤되고, 끄면 목록 컴포넌트가 직접
 * 남은 높이를 모두 쓴다(FlatList를 넣는 화면은 꺼야 한다).
 *
 * @param {{
 *   title?: string, subtitle?: string, onBack?: () => void, right?: React.ReactNode,
 *   scroll?: boolean, padded?: boolean, children: React.ReactNode
 * }} props
 */
import React, { useContext } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';

import Icon from './Icon';
import { colors, screenPadding, spacing, typography } from '../theme';

export default function Screen({
  title,
  subtitle,
  onBack,
  right,
  scroll = false,
  padded = true,
  children,
}) {
  const body = padded ? styles.padded : null;
  // 탭 안 화면은 탭 막대가 아래 여백을 맡는다. 탭 밖(루트 스택) 화면은 하단 버튼이
  // 시스템 내비게이션 막대에 붙지 않게 아래 안전 영역까지 띄운다.
  const insideTabs = useContext(BottomTabBarHeightContext) !== undefined;
  const edges = insideTabs ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom'];

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {(title || onBack || right) && (
        <View style={styles.header}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={styles.backButton} accessibilityRole="button">
              <Icon name="chevronLeft" size={24} color={colors.text} />
            </TouchableOpacity>
          ) : (
            <View style={styles.backSpacer} />
          )}

          <View style={styles.headerText}>
            {!!title && (
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            )}
            {!!subtitle && (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>

          <View style={styles.headerRight}>{right}</View>
        </View>
      )}

      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[body, styles.scrollContent]}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, body]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  padded: { paddingHorizontal: screenPadding },
  scrollContent: { paddingBottom: spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.sm,
    // 오른쪽 버튼이 본문 카드와 같은 여백 안에 들어오게 본문 여백과 맞춘다
    paddingRight: screenPadding,
    paddingVertical: spacing.sm,
    minHeight: 52,
  },
  backButton: { padding: spacing.sm },
  backSpacer: { width: spacing.sm },
  headerText: { flex: 1, paddingHorizontal: spacing.xs },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { ...typography.subtitle, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textSub },
});
