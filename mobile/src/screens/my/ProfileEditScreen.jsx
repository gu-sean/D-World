// MY-03 프로필 수정
//
// 닉네임을 바꾼다. 서버가 중복을 보고 거절할 수 있으므로 저장 결과를 기다려
// 알리고, 되돌아오는 오류는 입력칸 위 띠로 보여 준다.
//
// 연결된 로그인 수단(휴대폰·소셜)은 여기서 바꿀 수 없어 보여 주기만 한다.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { labels, useMe, useUpdateProfile, validators } from '../../client';
import {
  FormScrollView,
  Button,
  Card,
  ErrorBanner,
  Icon,
  QueryState,
  Screen,
  TextField,
} from '../../components';
import { colors, spacing, typography } from '../../theme';

const PROVIDER_NAME = { google: '구글', naver: '네이버', apple: '애플' };

export default function ProfileEditScreen({ navigation }) {
  const me = useMe();
  const updateProfile = useUpdateProfile();

  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!me.data) return;
    setNickname(me.data.nickname ?? '');
    setAge(me.data.age == null ? '' : String(me.data.age));
    setHeightCm(me.data.heightCm == null ? '' : String(me.data.heightCm));
    setWeightKg(me.data.weightKg == null ? '' : String(me.data.weightKg));
  }, [me.data]);

  const check = validators.validateNickname(nickname);
  const fitnessCheck = validators.validateFitnessProfile({ age, heightCm, weightKg });
  const changed = me.data
    ? nickname.trim() !== me.data.nickname ||
      Number(age) !== me.data.age ||
      Number(heightCm) !== me.data.heightCm ||
      Number(weightKg) !== me.data.weightKg
    : false;

  const save = () =>
    updateProfile.mutate(
      {
        nickname: nickname.trim(),
        age: Number(age),
        heightCm: Number(heightCm),
        weightKg: Number(weightKg),
      },
      { onSuccess: () => navigation.goBack() },
    );

  return (
    <Screen title="프로필 수정" onBack={() => navigation.goBack()} padded={false}>
      <QueryState query={me}>
        {(data) => (
          <FormScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <ErrorBanner error={updateProfile.error} />

            <TextField
              label="닉네임"
              value={nickname}
              onChangeText={(text) => {
                setNickname(text);
                setTouched(true);
              }}
              maxLength={12}
              hint="한글·영문·숫자 2~12자"
              error={touched && !check.ok ? check.message : null}
            />

            <TextField
              label="나이"
              value={age}
              onChangeText={(text) => setAge(text.replace(/\D/g, '').slice(0, 3))}
              keyboardType="number-pad"
            />
            <TextField
              label="키 (cm)"
              value={heightCm}
              onChangeText={(text) => setHeightCm(text.replace(/[^\d.]/g, '').slice(0, 6))}
              keyboardType="decimal-pad"
            />
            <TextField
              label="몸무게 (kg)"
              value={weightKg}
              onChangeText={(text) => setWeightKg(text.replace(/[^\d.]/g, '').slice(0, 6))}
              keyboardType="decimal-pad"
              error={!fitnessCheck.ok ? fitnessCheck.message : null}
              hint="수정하면 다음 난이도 추천부터 반영돼요."
            />

            <Card style={styles.card}>
              <Text style={styles.cardLabel}>로그인 수단</Text>
              <View style={styles.row}>
                <Icon name="user" size={16} color={colors.textSub} />
                <Text style={styles.rowText}>
                  휴대폰 로그인 {data.phoneLinked ? '사용 중' : '연결 안 됨'}
                </Text>
              </View>
              {(data.providers ?? []).map((provider) => (
                <View key={provider} style={styles.row}>
                  <Icon name="check" size={16} color={colors.success} />
                  <Text style={styles.rowText}>
                    {PROVIDER_NAME[provider] ?? provider} 계정 연결됨
                  </Text>
                </View>
              ))}
              <Text style={styles.cardNote}>
                로그인 수단은 여기서 바꿀 수 없어요. 문의로 알려 주세요.
              </Text>
            </Card>

            <Card style={styles.card}>
              <Text style={styles.cardLabel}>내 상태</Text>
              <Text style={styles.rowText}>
                {labels.userStatus.active}
              </Text>
            </Card>

            <Button
              title="저장"
              onPress={save}
              loading={updateProfile.isPending}
              disabled={!check.ok || !fitnessCheck.ok || !changed}
              full
            />
          </FormScrollView>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  card: { gap: spacing.xs },
  cardLabel: { ...typography.caption, color: colors.textSub },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { ...typography.body, color: colors.text, flex: 1 },
  cardNote: { ...typography.caption, color: colors.textSub, marginTop: spacing.xs },
});
