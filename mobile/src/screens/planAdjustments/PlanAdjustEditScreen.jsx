// BALANCE-06 새 계획 고치기
//
// AI가 제안한 계획을 그대로 받기 전에 손볼 수 있게 한다. 단계 제목과 각 미션의
// 목표량만 고치고, 필요 없는 미션은 뺄 수 있다. 단계나 날짜를 새로 만드는 일은
// 서버가 다시 계획해야 하는 범위라 여기서 다루지 않는다.
//
// 고친 계획은 확인 화면으로 넘겨 주고, 수락할 때 `plan`으로 함께 보낸다.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { format, usePlanAdjustment } from '../../client';
import { Button, Card, Icon, QueryState, Screen, TextField } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

/** 제안 계획을 화면에서 고칠 수 있는 형태로 복사한다. */
function toDraft(steps = []) {
  return steps.map((step) => ({
    ...step,
    missions: (step.missions ?? []).map((mission) => ({ ...mission, removed: false })),
  }));
}

/** 화면에서 고친 계획을 서버가 받는 `PlanStep[]` 모양으로 되돌린다. */
function toPlan(draft) {
  return draft.map((step) => ({
    ...step,
    missions: step.missions
      .filter((mission) => !mission.removed)
      .map(({ removed, ...mission }) => mission),
  }));
}

export default function PlanAdjustEditScreen({ navigation, route }) {
  const { adjustmentId } = route.params ?? {};
  const [draft, setDraft] = useState(null);
  const adjustment = usePlanAdjustment(adjustmentId);

  const steps = draft ?? toDraft(adjustment.data?.proposedPlan);

  const patchStep = (stepNo, patch) =>
    setDraft(steps.map((step) => (step.stepNo === stepNo ? { ...step, ...patch } : step)));

  const patchMission = (stepNo, index, patch) =>
    setDraft(
      steps.map((step) =>
        step.stepNo === stepNo
          ? {
              ...step,
              missions: step.missions.map((mission, i) =>
                i === index ? { ...mission, ...patch } : mission,
              ),
            }
          : step,
      ),
    );

  const remaining = steps.reduce(
    (sum, step) => sum + step.missions.filter((mission) => !mission.removed).length,
    0,
  );

  return (
    <Screen
      title="계획 고치기"
      subtitle={`남은 미션 ${remaining}개`}
      onBack={() => navigation.goBack()}
      padded={false}>
      <QueryState query={adjustment}>
        {() => (
          <>
            <ScrollView contentContainerStyle={styles.body}>
              <Text style={styles.hint}>
                제목과 목표량만 고칠 수 있어요. 빼고 싶은 미션은 오른쪽 버튼을 누르세요.
              </Text>

              {steps.map((step) => (
                <Card key={step.stepNo} style={styles.step}>
                  <View style={styles.stepHeader}>
                    <Text style={styles.stepNo}>{step.stepNo}단계</Text>
                    <Text style={styles.due}>{format.formatDate(step.dueDate)}까지</Text>
                  </View>

                  <TextField
                    value={step.title}
                    onChangeText={(title) => patchStep(step.stepNo, { title })}
                    maxLength={60}
                  />

                  {step.missions.map((mission, index) => (
                    <View
                      key={`${step.stepNo}-${index}`}
                      style={[styles.missionRow, mission.removed && styles.missionRemoved]}>
                      <Text style={styles.missionDate}>
                        {format.formatDate(mission.scheduledDate)}
                      </Text>

                      <View style={styles.missionBody}>
                        <Text style={styles.missionTitle} numberOfLines={1}>
                          {mission.title}
                        </Text>
                        <TextField
                          value={String(mission.targetValue ?? '')}
                          onChangeText={(text) =>
                            patchMission(step.stepNo, index, {
                              targetValue: Number(text.replace(/[^0-9]/g, '')) || 0,
                            })
                          }
                          keyboardType="number-pad"
                          editable={!mission.removed}
                          right={<Text style={styles.unit}>{mission.targetUnit}</Text>}
                        />
                      </View>

                      <Button
                        title={mission.removed ? '되돌리기' : '빼기'}
                        variant="text"
                        size="sm"
                        onPress={() =>
                          patchMission(step.stepNo, index, { removed: !mission.removed })
                        }
                      />
                    </View>
                  ))}
                </Card>
              ))}

              <View style={styles.note}>
                <Icon name="alert" size={16} color={colors.textSub} />
                <Text style={styles.noteText}>
                  미션을 너무 많이 빼면 목표를 제때 끝내기 어려워요.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <Button
                title="이대로 적용하기"
                onPress={() =>
                  navigation.navigate(Routes.PLAN_ADJUST_CONFIRM, {
                    adjustmentId,
                    plan: toPlan(steps),
                  })
                }
                disabled={remaining === 0}
                full
              />
            </View>
          </>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  hint: { ...typography.caption, color: colors.textSub },
  step: { gap: spacing.sm },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepNo: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  due: { ...typography.caption, color: colors.textSub },
  missionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  missionRemoved: { opacity: 0.45 },
  missionDate: { ...typography.caption, color: colors.textSub, width: 72 },
  missionBody: { flex: 1, gap: spacing.xs },
  missionTitle: { ...typography.body, color: colors.text },
  unit: { ...typography.caption, color: colors.textSub },
  note: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noteText: { ...typography.caption, color: colors.textSub, flex: 1 },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
