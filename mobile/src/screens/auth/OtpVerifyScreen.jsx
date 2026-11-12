// AUTH-07·17 인증번호 확인 (AUTH-22 만료·틀림)
//
// 6자리를 다 채우면 바로 확인 요청을 보낸다. 서버가 돌려주는 계정 상태에 따라
// 갈 곳이 달라진다.
//
//   new               처음 보는 번호        → 비밀번호 설정
//   phone_registered  이미 가입(휴대폰)     → 가입이면 기존 계정 안내 / 재설정이면 새 비밀번호
//   social_registered 이미 가입(소셜)       → 기존 소셜 계정 안내
//   not_registered    가입 이력 없음        → 재설정할 계정 없음 안내
//
// 틀리면 남은 시도 횟수를 함께 보여 주고 입력칸을 비운다.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useConfirmPhoneVerification, useRequestPhoneVerification } from '../../client';
import { Button, ErrorBanner, OtpInput, Screen } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

export default function OtpVerifyScreen({ navigation, route }) {
  const {
    purpose = 'signup',
    consents,
    phoneNumber,
    maskedPhoneNumber,
  } = route.params ?? {};

  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState({
    verificationId: route.params?.verificationId,
    expiresAt: route.params?.expiresAt,
    resendAvailableAt: route.params?.resendAvailableAt,
  });

  const confirm = useConfirmPhoneVerification();
  const resend = useRequestPhoneVerification();

  const goNext = (result) => {
    const { accountStatus, verificationToken, provider } = result;

    if (purpose === 'signup') {
      if (accountStatus === 'new') {
        navigation.navigate(Routes.PASSWORD_SETUP, { mode: 'signup', verificationToken, consents });
      } else if (accountStatus === 'phone_registered') {
        navigation.navigate(Routes.EXISTING_ACCOUNT, { kind: 'phone' });
      } else {
        navigation.navigate(Routes.EXISTING_ACCOUNT, { kind: 'social', provider });
      }
      return;
    }

    if (accountStatus === 'phone_registered') {
      navigation.navigate(Routes.PASSWORD_SETUP, { mode: 'reset', verificationToken });
    } else if (accountStatus === 'social_registered') {
      navigation.navigate(Routes.SOCIAL_RECOVERY_GUIDE, { provider });
    } else {
      navigation.navigate(Routes.RESET_ACCOUNT_NOT_FOUND);
    }
  };

  // 여섯 자리가 차면 사용자가 따로 누르지 않아도 확인한다.
  useEffect(() => {
    if (code.length !== 6 || confirm.isPending) return;
    confirm.mutate(
      { verificationId: challenge.verificationId, code },
      { onSuccess: goNext, onError: () => setCode('') },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const resendCode = () => {
    resend.mutate(
      { phoneNumber, purpose },
      {
        onSuccess: (started) => {
          setCode('');
          setChallenge({
            verificationId: started.verificationId,
            expiresAt: started.expiresAt,
            resendAvailableAt: started.resendAvailableAt,
          });
        },
      },
    );
  };

  const attemptsLeft = confirm.error?.details?.attemptsLeft;

  return (
    <Screen title="인증번호 입력" onBack={() => navigation.goBack()} scroll>
      <View style={styles.intro}>
        <Text style={styles.heading}>인증번호를 입력해 주세요</Text>
        <Text style={styles.description}>
          {maskedPhoneNumber ?? phoneNumber}로 보낸 6자리 숫자예요.
        </Text>
      </View>

      <ErrorBanner error={confirm.error ?? resend.error} />
      {attemptsLeft !== undefined && (
        <Text style={styles.attempts}>남은 시도 {attemptsLeft}번</Text>
      )}

      <OtpInput
        value={code}
        onChange={setCode}
        expiresAt={challenge.expiresAt}
        resendAvailableAt={challenge.resendAvailableAt}
        onResend={resendCode}
        resending={resend.isPending}
      />

      <View style={styles.footer}>
        <Button
          title="확인"
          onPress={() =>
            confirm.mutate(
              { verificationId: challenge.verificationId, code },
              { onSuccess: goNext, onError: () => setCode('') },
            )
          }
          loading={confirm.isPending}
          disabled={code.length !== 6}
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
  attempts: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  footer: { marginTop: spacing.xl },
});
