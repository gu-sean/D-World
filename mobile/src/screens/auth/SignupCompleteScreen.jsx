// AUTH-10 가입 완료
//
// 가입이 끝나 로그인까지 된 상태에서 잠깐 보여 주는 환영 화면이다.
// "시작하기"를 누르면 이 화면만 닫히고 아래에 있던 홈이 드러난다.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useSession } from '../../client';
import { Button, Icon, Screen } from '../../components';
import { colors, spacing, typography } from '../../theme';

export default function SignupCompleteScreen({ navigation }) {
  const { profile } = useSession();

  return (
    <Screen>
      <View style={styles.wrap}>
        <Icon name="check" size={56} color={colors.success} strokeWidth={2.4} />
        <Text style={styles.heading}>가입을 마쳤어요</Text>
        <Text style={styles.description}>
          {profile?.nickname ? `${profile.nickname}님, ` : ''}목표를 하나 만들어 볼까요?
        </Text>
      </View>

      <Button title="시작하기" onPress={() => navigation.goBack()} full />
      <View style={styles.bottomSpace} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  heading: { ...typography.title, color: colors.text },
  description: { ...typography.body, color: colors.textSub, textAlign: 'center' },
  bottomSpace: { height: spacing.xl },
});
