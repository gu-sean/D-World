// BALANCE-08 적용 완료
//
// 계획이 바뀌었다는 것을 알리고, 바로 다음 할 일로 보내 준다. 뒤로 가면 적용 확인
// 화면으로 돌아가므로 `replace`로 들어오고, 여기서는 목표 상세나 홈으로만 나간다.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Icon, Screen } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

export default function PlanAdjustResultScreen({ navigation, route }) {
  const { goalId } = route.params ?? {};

  const toGoal = () => {
    if (goalId) {
      navigation.replace(Routes.GOAL_DETAIL, { goalId });
    } else {
      navigation.popToTop();
    }
  };

  return (
    <Screen padded={false}>
      <View style={styles.body}>
        <Icon name="check" size={56} color={colors.success} />
        <Text style={styles.heading}>계획을 바꿨어요</Text>
        <Text style={styles.description}>
          오늘부터 새 계획으로 미션이 올라와요.{'\n'}부담스러우면 언제든 다시 조정할 수 있어요.
        </Text>
      </View>

      <View style={styles.footer}>
        <Button title="목표 보기" onPress={toGoal} full />
        <Button
          title="홈으로"
          variant="text"
          onPress={() => navigation.navigate(Routes.MAIN, { screen: Routes.HOME_TAB })}
          full
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  heading: { ...typography.title, color: colors.text },
  description: { ...typography.body, color: colors.textSub, textAlign: 'center' },
  footer: { padding: spacing.lg, gap: spacing.sm },
});
