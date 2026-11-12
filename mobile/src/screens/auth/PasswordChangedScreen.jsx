// AUTH-19 비밀번호 변경 완료
//
// 재설정이 끝났을 때 보인다. 서버가 이 사용자의 다른 기기 로그인도 모두 끊으므로,
// 새 비밀번호로 다시 로그인해야 한다는 점을 함께 알려 준다.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Icon, Screen } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

export default function PasswordChangedScreen({ navigation }) {
  return (
    <Screen>
      <View style={styles.wrap}>
        <Icon name="check" size={52} color={colors.success} strokeWidth={2.4} />
        <Text style={styles.heading}>비밀번호를 바꿨어요</Text>
        <Text style={styles.description}>
          안전을 위해 다른 기기의 로그인도 모두 풀렸어요. 새 비밀번호로 다시 로그인해 주세요.
        </Text>
      </View>

      <View style={styles.footer}>
        <Button title="로그인하러 가기" onPress={() => navigation.navigate(Routes.LOGIN)} full />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  heading: { ...typography.title, color: colors.text },
  description: { ...typography.body, color: colors.textSub, textAlign: 'center' },
  footer: { paddingBottom: spacing.xl },
});
