// BALANCE-10 재조정 기록 상세
//
// 이미 처리된 제안을 다시 들여다보는 화면. 그때 어떤 이유로 제안했고 어떤 계획을
// 권했는지 남겨 둔다. 적용된 제안은 적용된 계획을, 거절·만료된 제안은 적용되지
// 않았다는 사실을 함께 보여 준다.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { format, labels, usePlanAdjustment } from '../../client';
import { Card, Icon, PlanStepList, QueryState, Screen, StatusTag } from '../../components';
import { colors, spacing, typography } from '../../theme';

const TONE = {
  proposed: 'primary',
  accepted: 'success',
  rejected: 'neutral',
  expired: 'neutral',
};

export default function PlanAdjustHistoryDetailScreen({ navigation, route }) {
  const { adjustmentId } = route.params ?? {};
  const adjustment = usePlanAdjustment(adjustmentId);

  return (
    <Screen title="조정 기록" onBack={() => navigation.goBack()} padded={false}>
      <QueryState query={adjustment}>
        {(data) => (
          <ScrollView contentContainerStyle={styles.body}>
            <Card style={styles.head}>
              <View style={styles.topRow}>
                <Text style={styles.goal} numberOfLines={1}>
                  {data.goalTitle}
                </Text>
                <StatusTag
                  text={labels.planAdjustmentStatus[data.status]}
                  tone={TONE[data.status] ?? 'neutral'}
                />
              </View>
              <Text style={styles.reason}>{data.reason}</Text>
              <Text style={styles.meta}>
                {format.formatDate(data.createdAt)} 제안
                {data.decidedAt ? ` · ${format.formatDate(data.decidedAt)} 처리` : ''}
              </Text>
            </Card>

            {(data.causes ?? []).length > 0 && (
              <Card style={styles.causes}>
                <Text style={styles.sectionLabel}>그때 본 신호</Text>
                {data.causes.map((cause) => (
                  <View key={cause.code} style={styles.causeRow}>
                    <Icon name="dot" size={14} color={colors.textSub} />
                    <Text style={styles.causeLabel}>{cause.label}</Text>
                  </View>
                ))}
              </Card>
            )}

            <Text style={styles.sectionTitle}>
              {data.status === 'accepted' ? '적용된 계획' : '권했던 계획'}
            </Text>
            <PlanStepList steps={data.proposedPlan} compact />

            {data.status !== 'accepted' && (
              <Text style={styles.notApplied}>이 계획은 적용되지 않았어요.</Text>
            )}
          </ScrollView>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  head: { gap: spacing.xs },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  goal: { ...typography.subtitle, color: colors.text, flex: 1 },
  reason: { ...typography.body, color: colors.textSub },
  meta: { ...typography.caption, color: colors.textSub },
  causes: { gap: spacing.xs },
  sectionLabel: { ...typography.caption, color: colors.textSub },
  causeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  causeLabel: { ...typography.body, color: colors.text, flex: 1 },
  sectionTitle: { ...typography.subtitle, color: colors.text, marginTop: spacing.sm },
  notApplied: { ...typography.caption, color: colors.textSub, textAlign: 'center' },
});
