// AUTH-01·02 로그인 (AUTH-14 비밀번호 불일치, AUTH-15 5회 실패 잠금)
//
// 휴대폰 번호와 비밀번호로 로그인하거나, 소셜 계정으로 들어온다.
// 소셜 응답이 "아직 회원이 아님"이면 가입 확인 화면으로 보낸다.
//
// 로그인이 5번 틀려 잠기면 서버가 `AUTH_LOGIN_LOCKED`와 함께 풀리는 시각을 준다.
// 그때까지 버튼을 잠그고 남은 시간을 1초마다 보여 준다.
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useLogin, useSocialLogin, validators } from '../../client';
import { Button, ErrorBanner, Screen, TextField } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

/** 잠금이 풀릴 때까지 남은 초. 정보가 없으면 0. */
function lockSecondsLeft(error, nowMs) {
  if (error?.code !== 'AUTH_LOGIN_LOCKED') return 0;
  const retryAt = Date.parse(error?.details?.retryAt ?? '');
  if (Number.isNaN(retryAt)) return 0;
  return Math.max(0, Math.ceil((retryAt - nowMs) / 1000));
}

export default function LoginScreen({ navigation }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const login = useLogin();
  const socialLogin = useSocialLogin();

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const error = login.error ?? socialLogin.error;
  const lockLeft = useMemo(() => lockSecondsLeft(login.error, now), [login.error, now]);
  const canSubmit = validators.validatePhone(phoneNumber).ok && password.length > 0;

  const submit = () => login.mutate({ phoneNumber, password });

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
        onError: (socialError) => {
          if (socialError?.code === 'AUTH_SOCIAL_FAILED') {
            navigation.navigate(Routes.SOCIAL_AUTH_ERROR, { kind: 'failed', provider });
          }
        },
      },
    );
  };

  return (
    <Screen scroll>
      <View style={styles.brand}>
        <Text style={styles.logo}>D-World</Text>
        <Text style={styles.tagline}>오늘의 한 걸음을 함께해요</Text>
      </View>

      <ErrorBanner error={error} />

      <View style={styles.form}>
        <TextField
          label="휴대폰 번호"
          value={phoneNumber}
          onChangeText={(text) => setPhoneNumber(text.replace(/\D/g, '').slice(0, 11))}
          placeholder="01012345678"
          keyboardType="number-pad"
          maxLength={11}
        />
        <TextField
          label="비밀번호"
          value={password}
          onChangeText={setPassword}
          placeholder="비밀번호"
          secureTextEntry
        />

        <Button
          title={lockLeft > 0 ? `${lockLeft}초 후에 다시 시도할 수 있어요` : '로그인'}
          onPress={submit}
          loading={login.isPending}
          disabled={!canSubmit || lockLeft > 0}
          full
        />

        <TouchableOpacity
          onPress={() =>
            navigation.navigate(Routes.PHONE_NUMBER, { purpose: 'reset_password' })
          }
          accessibilityRole="button">
          <Text style={styles.link}>비밀번호를 잊으셨나요?</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>또는</Text>
        <View style={styles.line} />
      </View>

      <View style={styles.socials}>
        <Button
          title="구글로 계속하기"
          variant="secondary"
          onPress={() => startSocial('google')}
          loading={socialLogin.isPending}
          full
        />
        <Button
          title="네이버로 계속하기"
          variant="secondary"
          onPress={() => startSocial('naver')}
          loading={socialLogin.isPending}
          full
        />
      </View>

      <TouchableOpacity
        onPress={() => navigation.navigate(Routes.SIGNUP_METHOD)}
        accessibilityRole="button"
        style={styles.signup}>
        <Text style={styles.signupText}>아직 계정이 없으신가요? 가입하기</Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', paddingVertical: spacing.xxl },
  logo: { ...typography.title, fontSize: 32, color: colors.primary },
  tagline: { ...typography.caption, color: colors.textSub, marginTop: spacing.xs },
  form: { gap: spacing.md },
  link: { ...typography.caption, color: colors.textSub, textAlign: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xl },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.caption, color: colors.textSub },
  socials: { gap: spacing.sm },
  signup: { marginTop: spacing.xl, alignItems: 'center' },
  signupText: { ...typography.body, color: colors.primary },
});
