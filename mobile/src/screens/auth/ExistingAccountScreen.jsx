// AUTH-11·25 이미 가입된 계정 안내
//
// 가입하려는 번호가 이미 쓰이고 있을 때 보인다. `kind`로 문구가 갈린다.
//   phone   휴대폰 번호로 가입된 계정 → 로그인하거나 비밀번호를 재설정
//   social  소셜 계정으로 가입된 계정 → 그 소셜로 로그인
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Icon, Screen } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const PROVIDER_NAMES = { google: '구글', naver: '네이버', apple: '애플' };

export default function ExistingAccountScreen({ navigation, route }) {
  const { kind = 'phone', provider } = route.params ?? {};
  const providerName = PROVIDER_NAMES[provider] ?? '소셜';

  return (
    <Screen title="이미 가입된 번호" onBack={() => navigation.goBack()}>
      <View style={styles.wrap}>
        <Icon name="alert" size={48} color={colors.warning} />
        <Text style={styles.heading}>이미 가입한 번호예요</Text>
        <Text style={styles.description}>
          {kind === 'social'
            ? `이 번호는 ${providerName} 계정으로 가입돼 있어요. ${providerName}로 로그인해 주세요.`
            : '이 번호로 가입한 계정이 있어요. 로그인하거나 비밀번호를 다시 정해 주세요.'}
        </Text>
      </View>

      <View style={styles.buttons}>
        <Button
          title="로그인하러 가기"
          onPress={() => navigation.navigate(Routes.LOGIN)}
          full
        />
        {kind === 'phone' && (
          <Button
            title="비밀번호 재설정"
            variant="secondary"
            onPress={() =>
              navigation.navigate(Routes.PHONE_NUMBER, { purpose: 'reset_password' })
            }
            full
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  heading: { ...typography.title, color: colors.text },
  description: { ...typography.body, color: colors.textSub, textAlign: 'center' },
  buttons: { gap: spacing.sm, paddingBottom: spacing.xl },
});
