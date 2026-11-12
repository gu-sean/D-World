// AUTH-03 가입 방법 선택
//
// 휴대폰으로 가입할지 소셜 계정으로 가입할지 고른다.
// 휴대폰을 고르면 약관 동의부터, 소셜은 바로 그 계정으로 로그인을 시도한다.
// 이미 가입된 소셜 계정이면 세션이 열려 메인으로 들어가고,
// 처음이면 가입 확인 화면으로 넘어간다.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useSocialLogin } from '../../client';
import { Button, ErrorBanner, Screen } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

export default function SignupMethodScreen({ navigation }) {
  const socialLogin = useSocialLogin();

  const startSocial = (provider) => {
    socialLogin.mutate(
      { provider },
      {
        onSuccess: (result) => {
          if (result?.signupRequired) {
            navigation.navigate(Routes.SOCIAL_SIGNUP_CONFIRM, {
              provider: result.provider,
              email: result.email,
              socialSignupToken: result.socialSignupToken,
            });
          }
        },
        onError: () => {
          navigation.navigate(Routes.SOCIAL_AUTH_ERROR, { kind: 'failed', provider });
        },
      },
    );
  };

  return (
    <Screen title="가입 방법" onBack={() => navigation.goBack()} scroll>
      <View style={styles.intro}>
        <Text style={styles.heading}>어떻게 시작할까요?</Text>
        <Text style={styles.description}>
          나중에 설정에서 다른 방법을 더 연결할 수 있어요.
        </Text>
      </View>

      <ErrorBanner error={socialLogin.error} />

      <View style={styles.buttons}>
        <Button
          title="휴대폰 번호로 가입"
          onPress={() => navigation.navigate(Routes.TERMS_AGREEMENT, { purpose: 'phone' })}
          full
        />
        <Button
          title="구글로 가입"
          variant="secondary"
          onPress={() => startSocial('google')}
          loading={socialLogin.isPending}
          full
        />
        <Button
          title="네이버로 가입"
          variant="secondary"
          onPress={() => startSocial('naver')}
          loading={socialLogin.isPending}
          full
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { paddingVertical: spacing.xl, gap: spacing.xs },
  heading: { ...typography.title, color: colors.text },
  description: { ...typography.body, color: colors.textSub },
  buttons: { gap: spacing.sm },
});
