// AUTH-06·16 휴대폰 번호 입력 (AUTH-21 문자 발송 실패·재전송 제한)
//
// 가입과 비밀번호 재설정이 같은 화면을 쓴다. `purpose`로 구분하며 문구만 달라진다.
// 번호를 보내면 서버가 인증번호를 발송하고 확인 화면에서 쓸 정보를 돌려준다.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useRequestPhoneVerification, validators } from '../../client';
import { Button, ErrorBanner, Screen, TextField } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

export default function PhoneNumberScreen({ navigation, route }) {
  const { purpose = 'signup', consents } = route.params ?? {};
  const [phoneNumber, setPhoneNumber] = useState('');
  const [touched, setTouched] = useState(false);

  const request = useRequestPhoneVerification();
  const check = validators.validatePhone(phoneNumber);

  const submit = () => {
    request.mutate(
      { phoneNumber, purpose },
      {
        onSuccess: (started) =>
          navigation.navigate(Routes.OTP_VERIFY, {
            purpose,
            consents,
            phoneNumber,
            verificationId: started.verificationId,
            maskedPhoneNumber: started.maskedPhoneNumber,
            expiresAt: started.expiresAt,
            resendAvailableAt: started.resendAvailableAt,
          }),
      },
    );
  };

  return (
    <Screen
      title={purpose === 'reset_password' ? '비밀번호 재설정' : '휴대폰 인증'}
      onBack={() => navigation.goBack()}
      scroll>
      <View style={styles.intro}>
        <Text style={styles.heading}>휴대폰 번호를 입력해 주세요</Text>
        <Text style={styles.description}>
          {purpose === 'reset_password'
            ? '가입할 때 쓴 번호로 인증번호를 보내 드려요.'
            : '본인 확인을 위해 인증번호를 보내 드려요.'}
        </Text>
      </View>

      <ErrorBanner error={request.error} />

      <TextField
        label="휴대폰 번호"
        value={phoneNumber}
        onChangeText={(text) => {
          setPhoneNumber(text.replace(/\D/g, '').slice(0, 11));
          setTouched(true);
        }}
        placeholder="01012345678"
        keyboardType="number-pad"
        maxLength={11}
        error={touched && !check.ok ? check.message : null}
        hint="숫자만 입력해 주세요"
        autoFocus
      />

      <View style={styles.footer}>
        <Button
          title="인증번호 받기"
          onPress={submit}
          loading={request.isPending}
          disabled={!check.ok}
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
  footer: { marginTop: spacing.xl },
});
