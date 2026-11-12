// BALANCE-03 재조정 이유
//
// AI가 계획을 다시 짜자고 제안한 이유를 먼저 보여 준다. 서버가 분석한 원인
// (달성률이 낮음·양이 많음·빠진 날이 많음)을 숫자와 함께 그대로 싣는다.
//
// 수락 기한이 있으므로 언제까지 정하면 되는지도 알려 준다.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { format, usePlanAdjustment } from '../../client';
import { Button, Card, Icon, QueryState, Screen } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const CAUSE_ICONS = {
  low_completion: 'chart',
  overload: 'alert',
  missed_days: 'calendar',
};

export default function PlanAdjustReasonScreen({ navigation, route }) {
  const { adjustmentId } = route.params ?? {};
  const adjustment = usePlanAdjustment(adjustmentId);

  return (
    <Screen title="계획 다시 보기" onBack={() => navigation.goBack()} padded={false}>
      <QueryState query={adjustment}>
        {(data) => (
          <>
            <ScrollView contentContainerStyle={styles.body}>
              <View style={styles.hero}>
                <Icon name="refresh" size={44} color={colors.primary} />
                <Text style={styles.heading}>계획을 조금 바꿔 볼까요?</Text>
                <Text style={styles.goal}>{data.goalTitle}</Text>
              </View>

              <Card>
                <Text style={styles.reason}>{data.reason}</Text>
              </Card>

              {(data.causes ?? []).length > 0 && (
                <Card style={styles.causes}>
                  <Text style={styles.causesLabel}>이렇게 봤어요</Text>
                  {data.causes.map((cause) => (
                    <View key={cause.code} style={styles.causeRow}>
                      <Icon
                        name={CAUSE_ICONS[cause.code] ?? 'dot'}
                        size={18}
                        color={colors.warning}
                      />
                      <Text style={styles.causeLabel}>{cause.label}</Text>
                    </View>
                  ))}
                </Card>
              )}

              <Text style={styles.expires}>
                {format.formatDate(data.expiresAt)}까지 정하면 돼요.
              </Text>
            </ScrollView>

            <View style={styles.footer}>
              <Button
                title="새 계획 보기"
                onPress={() =>
                  navigation.navigate(Routes.PLAN_ADJUST_PROPOSAL, { adjustmentId })
                }
                full
              />
              <Button title="나중에" variant="text" onPress={() => navigation.goBack()} full />
            </View>
          </>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg },
  heading: { ...typography.title, color: colors.text, textAlign: 'center' },
  goal: { ...typography.caption, color: colors.textSub },
  reason: { ...typography.body, color: colors.text },
  causes: { gap: spacing.sm },
  causesLabel: { ...typography.caption, color: colors.textSub },
  causeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  causeLabel: { ...typography.body, color: colors.text, flex: 1 },
  expires: { ...typography.caption, color: colors.textSub, textAlign: 'center' },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
