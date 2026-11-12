// AUTH-08·18 비밀번호 설정 (AUTH-23 두 칸 불일치, AUTH-27 인증 시간 만료)
//
// 가입과 재설정이 같은 화면을 쓴다.
//   signup  여기서는 서버를 부르지 않고 닉네임 화면으로 값을 넘긴다 (가입은 한 번에 처리)
//   reset   바로 재설정 요청을 보내고, 성공하면 완료 안내로 간다
//
// 두 칸이 서로 다른지는 화면에서 바로 검사하고, 길이 규칙은 기능 모듈의 검사기를 쓴다.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useResetPassword, validators } from '../../client';
import { Button, ErrorBanner, Screen, TextField } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

export default function PasswordSetupScreen({ navigation, route }) {
  const { mode = 'signup', verificationToken, consents } = route.params ?? {};

  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [touched, setTouched] = useState(false);

  const resetPassword = useResetPassword();

  const passwordCheck = validators.validatePassword(password);
  const matchCheck = validators.validatePasswordConfirm(password, confirmText);
  const ready = passwordCheck.ok && matchCheck.ok;

  const submit = () => {
    if (mode === 'reset') {
      resetPassword.mutate(
        { verificationToken, newPassword: password },
        { onSuccess: () => navigation.navigate(Routes.PASSWORD_CHANGED) },
      );
      return;
    }
    navigation.navigate(Routes.NICKNAME_SETUP, { verificationToken, password, consents });
  };

  return (
    <Screen
      title={mode === 'reset' ? '새 비밀번호' : '비밀번호 설정'}
      onBack={() => navigation.goBack()}
      scroll>
      <View style={styles.intro}>
        <Text style={styles.heading}>
          {mode === 'reset' ? '새 비밀번호를 정해 주세요' : '비밀번호를 정해 주세요'}
        </Text>
        <Text style={styles.description}>10~64자로 입력해 주세요.</Text>
      </View>

      <ErrorBanner error={resetPassword.error} />

      <View style={styles.form}>
        <TextField
          label="비밀번호"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setTouched(true);
          }}
          secureTextEntry
          error={touched && !passwordCheck.ok ? passwordCheck.message : null}
          autoFocus
        />
        <TextField
          label="비밀번호 확인"
          value={confirmText}
          onChangeText={(text) => {
            setConfirmText(text);
            setTouched(true);
          }}
          secureTextEntry
          error={touched && passwordCheck.ok && !matchCheck.ok ? matchCheck.message : null}
        />
      </View>

      <View style={styles.footer}>
        <Button
          title={mode === 'reset' ? '비밀번호 바꾸기' : '다음'}
          onPress={submit}
          loading={resetPassword.isPending}
          disabled={!ready}
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
  form: { gap: spacing.md },
  footer: { marginTop: spacing.xl },
});
