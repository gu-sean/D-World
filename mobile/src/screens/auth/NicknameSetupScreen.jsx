// AUTH-09 닉네임 설정 (AUTH-24 이미 쓰는 닉네임)
//
// 가입의 마지막 입력 단계다. 입력이 멈추고 잠시 뒤 중복 여부를 확인해서
// 바로 알려 주고, 가입 버튼을 누르면 앞 화면들에서 모아 온 값으로 가입을 끝낸다.
//
// 휴대폰 가입이면 인증 토큰과 비밀번호를, 소셜 가입이면 소셜 가입 토큰을 보낸다.
// 성공하면 세션이 열리므로 완료 화면만 보여 주면 된다.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useNicknameAvailability, useSignup, validators } from '../../client';
import { Button, ErrorBanner, Screen, TextField } from '../../components';
import { navigate } from '../../navigation/navigationRef';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

export default function NicknameSetupScreen({ navigation, route }) {
  const { verificationToken, password, socialSignupToken, consents, suggestedAge } = route.params ?? {};

  const [nickname, setNickname] = useState('');
  // 네이버 출생연도로 계산한 나이가 오면 미리 채운다 (고칠 수 있음)
  const [age, setAge] = useState(suggestedAge ? String(suggestedAge) : '');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [touched, setTouched] = useState(false);

  const availability = useNicknameAvailability(nickname);
  const signup = useSignup();

  const formatCheck = validators.validateNickname(nickname);
  const fitnessCheck = validators.validateFitnessProfile({ age, heightCm, weightKg });
  const taken = availability.data?.available === false;
  const ready = formatCheck.ok && fitnessCheck.ok && availability.data?.available === true;

  const submit = () => {
    signup.mutate(
      {
        nickname,
        age: Number(age),
        heightCm: Number(heightCm),
        weightKg: Number(weightKg),
        consents,
        ...(socialSignupToken ? { socialSignupToken } : { verificationToken, password }),
      },
      {
        onSuccess: () => {
          // 가입이 끝나면 세션이 열려 이 화면이 속한 묶음이 통째로 바뀐다.
          // 바뀐 뒤에 완료 화면으로 가야 하므로 한 틱 뒤에 루트에서 이동한다.
          setTimeout(() => navigate(Routes.SIGNUP_COMPLETE), 0);
        },
      },
    );
  };

  let helper = null;
  if (touched && !formatCheck.ok) helper = formatCheck.message;
  else if (taken) helper = '이미 쓰고 있는 닉네임이에요.';

  return (
    <Screen title="닉네임" onBack={() => navigation.goBack()} scroll>
      <View style={styles.intro}>
        <Text style={styles.heading}>어떻게 불러드릴까요?</Text>
        <Text style={styles.description}>한글·영문·숫자 2~12자로 정해 주세요.</Text>
      </View>

      <ErrorBanner error={signup.error} />

      <TextField
        label="닉네임"
        value={nickname}
        onChangeText={(text) => {
          setNickname(text);
          setTouched(true);
        }}
        placeholder="닉네임"
        maxLength={12}
        error={helper}
        hint={ready ? '쓸 수 있는 닉네임이에요' : null}
        autoFocus
      />

      <View style={styles.fitnessIntro}>
        <Text style={styles.fitnessTitle}>시작 난이도 추천 정보</Text>
        <Text style={styles.fitnessText}>
          나이·키·몸무게와 이후 수행 기록을 에이전트들이 차례로 검토해 쉬움·보통·어려움을
          추천해요.
        </Text>
      </View>
      <TextField
        label="나이"
        value={age}
        onChangeText={(text) => setAge(text.replace(/\D/g, '').slice(0, 3))}
        placeholder="예) 25"
        keyboardType="number-pad"
      />
      <TextField
        label="키 (cm)"
        value={heightCm}
        onChangeText={(text) => setHeightCm(text.replace(/[^\d.]/g, '').slice(0, 6))}
        placeholder="예) 175"
        keyboardType="decimal-pad"
      />
      <TextField
        label="몸무게 (kg)"
        value={weightKg}
        onChangeText={(text) => setWeightKg(text.replace(/[^\d.]/g, '').slice(0, 6))}
        placeholder="예) 68"
        keyboardType="decimal-pad"
        error={age || heightCm || weightKg ? (!fitnessCheck.ok ? fitnessCheck.message : null) : null}
      />

      <View style={styles.footer}>
        <Button
          title="가입 완료"
          onPress={submit}
          loading={signup.isPending}
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
  fitnessIntro: { marginTop: spacing.lg, gap: spacing.xs },
  fitnessTitle: { ...typography.bodyStrong, color: colors.text },
  fitnessText: { ...typography.caption, color: colors.textSub },
  footer: { marginTop: spacing.xl },
});
