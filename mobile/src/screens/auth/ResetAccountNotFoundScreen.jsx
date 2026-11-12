// AUTH-26 재설정할 계정 없음
//
// 비밀번호를 재설정하려는 번호로 가입한 계정이 없을 때 보인다.
// 번호를 다시 확인하게 하거나, 그대로 가입으로 넘어갈 수 있게 한다.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Icon, Screen } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

export default function ResetAccountNotFoundScreen({ navigation }) {
  return (
    <Screen title="계정을 찾을 수 없어요" onBack={() => navigation.goBack()}>
      <View style={styles.wrap}>
        <Icon name="search" size={48} color={colors.textSub} />
        <Text style={styles.heading}>가입한 계정이 없어요</Text>
        <Text style={styles.description}>
          번호를 다시 확인해 주세요. 아직 가입 전이라면 지금 가입할 수 있어요.
        </Text>
      </View>

      <View style={styles.buttons}>
        <Button title="번호 다시 입력" onPress={() => navigation.goBack()} full />
        <Button
          title="가입하기"
          variant="secondary"
          onPress={() => navigation.navigate(Routes.TERMS_AGREEMENT, { purpose: 'phone' })}
          full
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  heading: { ...typography.title, color: colors.text },
  description: { ...typography.body, color: colors.textSub, textAlign: 'center' },
  buttons: { gap: spacing.sm, paddingBottom: spacing.xl },
});
