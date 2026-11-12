// MISSION-06 AI 계획 만드는 중
//
// 화면에 들어오면 바로 계획 생성을 요청하고, 끝날 때까지 기다린다.
// 서버가 AI 응답을 받아 검사까지 마치는 데 1분 가까이 걸릴 수 있다.
//
// 가짜 진행률 막대는 쓰지 않는다. 대신 지금 어느 단계인지 알려 주는 문구를
// 순서대로 바꿔 보여 주고, 끝나면 제안 화면으로 넘어간다.
// 실패하면 이유를 보여 주고 다시 시도할 수 있게 한다.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useGeneratePlan } from '../../client';
import { Button, ErrorBanner, Screen } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

/** 기다리는 동안 번갈아 보여 주는 안내. 실제 진행도가 아니라 안내 문구다. */
const STAGES = [
  '목표를 살펴보고 있어요',
  '단계를 나누고 있어요',
  '날짜별 미션을 짜고 있어요',
  '거의 다 됐어요',
];

export default function PlanGeneratingScreen({ navigation, route }) {
  const { goalId } = route.params ?? {};
  const [stage, setStage] = useState(0);
  const generatePlan = useGeneratePlan();

  // 문구를 8초마다 다음 것으로 넘긴다. 마지막 문구에서 멈춘다.
  useEffect(() => {
    const timer = setInterval(
      () => setStage((prev) => Math.min(prev + 1, STAGES.length - 1)),
      8000,
    );
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    generatePlan.mutate(
      { goalId },
      { onSuccess: () => navigation.replace(Routes.PLAN_PROPOSAL, { goalId }) },
    );
    // 화면에 처음 들어올 때 한 번만 보낸다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const failed = generatePlan.isError;

  return (
    <Screen title="계획 만들기" onBack={() => navigation.goBack()}>
      <View style={styles.wrap}>
        {failed ? (
          <>
            <ErrorBanner error={generatePlan.error} />
            <Text style={styles.heading}>계획을 만들지 못했어요</Text>
            <Text style={styles.description}>
              잠시 후 다시 시도하면 대부분 해결돼요.
            </Text>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.heading}>{STAGES[stage]}</Text>
            <Text style={styles.description}>
              최대 1분쯤 걸려요. 화면을 닫지 말고 기다려 주세요.
            </Text>
          </>
        )}
      </View>

      {failed && (
        <View style={styles.footer}>
          <Button title="다시 시도" onPress={() => generatePlan.retry()} full />
          <Button title="나중에 하기" variant="text" onPress={() => navigation.goBack()} full />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  heading: { ...typography.subtitle, color: colors.text, textAlign: 'center' },
  description: { ...typography.caption, color: colors.textSub, textAlign: 'center' },
  footer: { gap: spacing.sm, paddingBottom: spacing.xl },
});
