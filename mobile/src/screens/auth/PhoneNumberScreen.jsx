// AUTH-06·16 휴대폰 번호 입력
//
// 가입과 비밀번호 재설정이 같은 화면을 쓴다. `purpose`로 구분하며 문구만 달라진다.
// 인증번호 단계는 없다. 번호를 보내면 서버가 바로 계정 상태를 돌려주고, 그에 따라 갈 곳이 달라진다.
//
//   new               처음 보는 번호        → 비밀번호 설정
//   phone_registered  이미 가입(휴대폰)     → 가입이면 기존 계정 안내 / 재설정이면 새 비밀번호
//   social_registered 이미 가입(소셜)       → 기존 소셜 계정 안내
//   not_registered    가입 이력 없음        → 재설정할 계정 없음 안내
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

  const goNext = ({ accountStatus, verificationToken, provider }) => {
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

  const submit = () => {
    request.mutate({ phoneNumber, purpose }, { onSuccess: goNext });
  };

  return (
    <Screen
      title={purpose === 'reset_password' ? '비밀번호 재설정' : '휴대폰 번호'}
      onBack={() => navigation.goBack()}
      scroll>
      <View style={styles.intro}>
        <Text style={styles.heading}>휴대폰 번호를 입력해 주세요</Text>
        <Text style={styles.description}>
          {purpose === 'reset_password'
            ? '가입할 때 쓴 번호를 입력해 주세요.'
            : '로그인할 때 쓸 번호예요.'}
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
          title="다음"
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
