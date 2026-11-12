// AUTH-12·13 소셜 로그인 중단·실패
//
// 소셜 로그인 창을 사용자가 닫았거나(cancelled) 연동이 실패했을 때(failed) 보인다.
// 둘 다 다시 시도하거나 휴대폰 번호로 돌아갈 수 있게 길을 열어 둔다.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Icon, Screen } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const PROVIDER_NAMES = { google: '구글', naver: '네이버', apple: '애플' };

export default function SocialAuthErrorScreen({ navigation, route }) {
  const { kind = 'failed', provider } = route.params ?? {};
  const providerName = PROVIDER_NAMES[provider] ?? '소셜';

  return (
    <Screen title="로그인 실패" onBack={() => navigation.goBack()}>
      <View style={styles.wrap}>
        <Icon name="close" size={48} color={colors.danger} strokeWidth={2.2} />
        <Text style={styles.heading}>
          {kind === 'cancelled' ? '로그인을 취소했어요' : `${providerName} 로그인에 실패했어요`}
        </Text>
        <Text style={styles.description}>
          {kind === 'cancelled'
            ? '다시 시도하거나 다른 방법으로 들어올 수 있어요.'
            : '잠시 후 다시 시도해 주세요. 계속 안 되면 휴대폰 번호로 가입할 수 있어요.'}
        </Text>
      </View>

      <View style={styles.buttons}>
        <Button title="다시 시도" onPress={() => navigation.goBack()} full />
        <Button
          title="휴대폰 번호로 가입"
          variant="secondary"
          onPress={() => navigation.navigate(Routes.TERMS_AGREEMENT, { purpose: 'phone' })}
          full
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  heading: { ...typography.title, color: colors.text, textAlign: 'center' },
  description: { ...typography.body, color: colors.textSub, textAlign: 'center' },
  buttons: { gap: spacing.sm, paddingBottom: spacing.xl },
});
