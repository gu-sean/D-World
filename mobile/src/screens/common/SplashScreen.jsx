// COMMON-00 시작 화면
//
// 앱을 켜고 저장된 토큰으로 로그인을 되살리는 동안 잠깐 보인다.
// 세션 상태가 정해지면 루트 내비게이터가 알아서 다음 화면으로 바꾼다.
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme';

export default function SplashScreen() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.logo}>D-World</Text>
      <Text style={styles.tagline}>목표를 미션으로, 미션을 습관으로</Text>
      <ActivityIndicator color={colors.primary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  logo: { ...typography.title, fontSize: 34, color: colors.primary },
  tagline: { ...typography.caption, color: colors.textSub, marginTop: spacing.sm },
  spinner: { marginTop: spacing.xl },
});
