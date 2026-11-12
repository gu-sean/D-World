// BALANCE-04 새 계획 제안
//
// AI가 다시 짠 계획을 단계별로 보여 준다. 여기서 바로 받아들이거나,
// 기존 계획과 나란히 비교해 보거나, 직접 손봐서 적용할 수 있다.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { format, usePlanAdjustment } from '../../client';
import { Button, Card, PlanStepList, QueryState, Screen } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

export default function PlanAdjustProposalScreen({ navigation, route }) {
  const { adjustmentId } = route.params ?? {};
  const adjustment = usePlanAdjustment(adjustmentId);

  return (
    <Screen title="새 계획" onBack={() => navigation.goBack()} padded={false}>
      <QueryState query={adjustment}>
        {(data) => (
          <>
            <ScrollView contentContainerStyle={styles.body}>
              <Card style={styles.summary}>
                <Text style={styles.goal}>{data.goalTitle}</Text>
                <Text style={styles.reason}>{data.reason}</Text>
                <Text style={styles.meta}>
                  {format.formatDate(data.createdAt)} 제안 ·{' '}
                  {format.formatDate(data.expiresAt)}까지
                </Text>
              </Card>

              <PlanStepList steps={data.proposedPlan} />
            </ScrollView>

            <View style={styles.footer}>
              <Button
                title="이 계획으로 바꾸기"
                onPress={() => navigation.navigate(Routes.PLAN_ADJUST_CONFIRM, { adjustmentId })}
                full
              />
              <View style={styles.row}>
                <View style={styles.slot}>
                  <Button
                    title="기존과 비교"
                    variant="secondary"
                    onPress={() =>
                      navigation.navigate(Routes.PLAN_ADJUST_COMPARE, { adjustmentId })
                    }
                    full
                  />
                </View>
                <View style={styles.slot}>
                  <Button
                    title="직접 고치기"
                    variant="secondary"
                    onPress={() => navigation.navigate(Routes.PLAN_ADJUST_EDIT, { adjustmentId })}
                    full
                  />
                </View>
              </View>
            </View>
          </>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  summary: { gap: spacing.xs },
  goal: { ...typography.subtitle, color: colors.text },
  reason: { ...typography.body, color: colors.textSub },
  meta: { ...typography.caption, color: colors.textSub },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  slot: { flex: 1 },
});
