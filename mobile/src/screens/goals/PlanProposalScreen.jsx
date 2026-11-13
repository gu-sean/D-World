// MISSION-07 AI 계획 제안
//
// AI가 만든 계획을 단계별로 펼쳐 보여 준다. 각 단계 아래에 날짜별 미션이 들어 있다.
//
// 고를 수 있는 것 세 가지
//   수락       계획대로 미션이 한꺼번에 만들어지고 결과 화면으로 간다
//   다시 만들기 같은 목표로 새 제안을 받는다 (세대 번호가 올라간다)
//   거절       제안을 버리고 목표 상세로 돌아간다
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  format,
  useAcceptPlan,
  useGeneratePlan,
  useLatestPlan,
  useRejectPlan,
} from '../../client';
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorBanner,
  QueryState,
  Screen,
} from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

export default function PlanProposalScreen({ navigation, route }) {
  const { goalId } = route.params ?? {};
  const [confirmReject, setConfirmReject] = useState(false);

  const plan = useLatestPlan(goalId);
  const acceptPlan = useAcceptPlan();
  const rejectPlan = useRejectPlan();
  const generatePlan = useGeneratePlan();

  const accept = (proposal) =>
    acceptPlan.mutate(
      { proposalId: proposal.id, generationNo: proposal.generationNo },
      {
        onSuccess: (result) =>
          navigation.replace(Routes.PLAN_MISSIONS, {
            goalId,
            createdMissionCount: result.createdMissionCount,
            todayMissions: result.todayMissions,
          }),
      },
    );

  const reject = (proposal) =>
    rejectPlan.mutate(
      { proposalId: proposal.id },
      {
        onSuccess: () => {
          setConfirmReject(false);
          navigation.replace(Routes.GOAL_DETAIL, { goalId });
        },
      },
    );

  const regenerate = () => {
    generatePlan.mutate({ goalId }, { onSuccess: () => plan.refetch() });
  };

  return (
    <Screen title="AI 계획 제안" onBack={() => navigation.goBack()} padded={false}>
      <QueryState query={plan} emptyTitle="아직 받은 제안이 없어요">
        {(proposal) => (
          <>
            <ScrollView contentContainerStyle={styles.body}>
              <ErrorBanner
                error={acceptPlan.error ?? rejectPlan.error ?? generatePlan.error}
              />

              <Card style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>AI 분석</Text>
                <Text style={styles.summary}>{proposal.summary}</Text>
                <Text style={styles.generation}>
                  {proposal.generationNo}번째 제안 ·{' '}
                  {format.formatDateTime(proposal.generatedAt)}
                </Text>
              </Card>

              {proposal.steps.map((step) => (
                <Card key={step.stepNo} style={styles.stepCard}>
                  <View style={styles.stepHeader}>
                    <Text style={styles.stepNo}>{step.stepNo}단계</Text>
                    <Text style={styles.stepDue}>{format.formatDate(step.dueDate)}까지</Text>
                  </View>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  {!!step.description && (
                    <Text style={styles.stepDescription}>{step.description}</Text>
                  )}

                  <View style={styles.missions}>
                    {step.missions.map((mission, index) => (
                      <View key={`${step.stepNo}-${index}`} style={styles.missionRow}>
                        <Text style={styles.missionDate}>
                          {format.formatDate(mission.scheduledDate)}
                        </Text>
                        <View style={styles.missionTexts}>
                          <Text style={styles.missionTitle}>{mission.title}</Text>
                          <Text style={styles.missionTarget}>
                            {format.formatMissionMeta(mission)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </Card>
              ))}
            </ScrollView>

            <View style={styles.footer}>
              <Button
                title="이 계획으로 시작하기"
                onPress={() => accept(proposal)}
                loading={acceptPlan.isPending}
                full
              />
              <View style={styles.footerRow}>
                <View style={styles.footerSlot}>
                  <Button
                    title="다시 만들기"
                    variant="secondary"
                    onPress={regenerate}
                    loading={generatePlan.isPending}
                    full
                  />
                </View>
                <View style={styles.footerSlot}>
                  <Button
                    title="거절"
                    variant="text"
                    onPress={() => setConfirmReject(true)}
                    full
                  />
                </View>
              </View>
            </View>

            <ConfirmDialog
              visible={confirmReject}
              title="이 제안을 거절할까요?"
              message="나중에 목표 상세에서 다시 만들 수 있어요."
              confirmText="거절"
              loading={rejectPlan.isPending}
              onConfirm={() => reject(proposal)}
              onCancel={() => setConfirmReject(false)}
            />
          </>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  summaryCard: { gap: spacing.xs },
  summaryLabel: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  summary: { ...typography.body, color: colors.text },
  generation: { ...typography.caption, color: colors.textSub },
  stepCard: { gap: spacing.xs },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepNo: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  stepDue: { ...typography.caption, color: colors.textSub },
  stepTitle: { ...typography.bodyStrong, color: colors.text },
  stepDescription: { ...typography.caption, color: colors.textSub },
  missions: { marginTop: spacing.sm, gap: spacing.sm },
  missionRow: { flexDirection: 'row', gap: spacing.md },
  missionDate: { ...typography.caption, color: colors.textSub, width: 92 },
  missionTexts: { flex: 1, gap: 2 },
  missionTitle: { ...typography.body, color: colors.text },
  missionTarget: { ...typography.caption, color: colors.textSub },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  footerSlot: { flex: 1 },
});
