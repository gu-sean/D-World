/**
 * 계획을 단계·미션 순으로 펼쳐 보여 주는 목록.
 *
 * AI 계획 제안과 계획 재조정이 같은 모양(`PlanStep[]`)을 쓰기 때문에 한 곳에 모았다.
 * `compact`를 켜면 날짜와 제목만 짧게 보여 준다 — 두 계획을 나란히 비교할 때 쓴다.
 *
 * @param {{steps: object[], compact?: boolean}} props
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Card from './Card';
import { format } from '../client';
import { colors, spacing, typography } from '../theme';

export default function PlanStepList({ steps = [], compact = false }) {
  return (
    <View style={styles.wrap}>
      {steps.map((step) => (
        <Card key={step.stepNo} style={styles.step}>
          <View style={styles.header}>
            <Text style={styles.stepNo}>{step.stepNo}단계</Text>
            <Text style={styles.due}>{format.formatDate(step.dueDate)}까지</Text>
          </View>
          <Text style={styles.title}>{step.title}</Text>
          {!compact && !!step.description && (
            <Text style={styles.description}>{step.description}</Text>
          )}

          <View style={styles.missions}>
            {(step.missions ?? []).map((mission, index) => (
              <View key={`${step.stepNo}-${index}`} style={styles.missionRow}>
                <Text style={styles.missionDate}>
                  {format.formatDate(mission.scheduledDate)}
                </Text>
                <View style={styles.missionTexts}>
                  <Text style={styles.missionTitle} numberOfLines={compact ? 1 : 2}>
                    {mission.title}
                  </Text>
                  {!compact && (
                    <Text style={styles.missionMeta}>{format.formatMissionMeta(mission)}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  step: { gap: spacing.xs },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepNo: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  due: { ...typography.caption, color: colors.textSub },
  title: { ...typography.bodyStrong, color: colors.text },
  description: { ...typography.caption, color: colors.textSub },
  missions: { marginTop: spacing.xs, gap: spacing.xs },
  missionRow: { flexDirection: 'row', gap: spacing.sm },
  missionDate: { ...typography.caption, color: colors.textSub, width: 86 },
  missionTexts: { flex: 1 },
  missionTitle: { ...typography.body, color: colors.text },
  missionMeta: { ...typography.caption, color: colors.textSub },
});
