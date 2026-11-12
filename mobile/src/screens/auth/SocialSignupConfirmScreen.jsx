// AUTH-04 소셜 가입 확인
//
// 소셜 로그인을 했는데 아직 회원이 아닐 때 보인다. 어떤 계정으로 가입하게 되는지
// 보여 주고, 이어서 약관 동의로 넘긴다. 가입 토큰은 30분만 쓸 수 있어서
// 다음 화면들로 그대로 전달한다.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const PROVIDER_NAMES = { google: '구글', naver: '네이버', apple: '애플' };

export default function SocialSignupConfirmScreen({ navigation, route }) {
  const { provider, email, socialSignupToken } = route.params ?? {};
  const providerName = PROVIDER_NAMES[provider] ?? provider;

  return (
    <Screen title="가입 확인" onBack={() => navigation.goBack()} scroll>
      <Text style={styles.heading}>{providerName} 계정으로 가입할까요?</Text>

      <Card style={styles.card}>
        <Text style={styles.label}>연결할 계정</Text>
        <Text style={styles.value}>{email ?? `${providerName} 계정`}</Text>
      </Card>

      <Text style={styles.note}>
        가입을 마치면 이 계정으로 로그인할 수 있어요.
      </Text>

      <View style={styles.buttons}>
        <Button
          title="계속하기"
          onPress={() =>
            navigation.navigate(Routes.TERMS_AGREEMENT, { purpose: 'social', socialSignupToken })
          }
          full
        />
        <Button title="다른 방법으로 가입" variant="text" onPress={() => navigation.goBack()} full />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { ...typography.title, color: colors.text, paddingVertical: spacing.xl },
  card: { gap: spacing.xs },
  label: { ...typography.caption, color: colors.textSub },
  value: { ...typography.bodyStrong, color: colors.text },
  note: { ...typography.caption, color: colors.textSub, marginTop: spacing.md },
  buttons: { gap: spacing.sm, marginTop: spacing.xl },
});
