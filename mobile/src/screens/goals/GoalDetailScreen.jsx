// MISSION-04 목표 상세
//
// 목표 하나의 전체 모습을 보여 준다. 기간·진행률·미션 수와 단계별 로드맵이 있고,
// 지금 진행 중인 단계가 표시된다.
//
// 할 수 있는 일: 수정, 일시정지와 다시 시작, 삭제, 그리고 아직 계획이 없으면 AI 계획 만들기.
// 삭제는 되돌릴 수 없으므로 확인 창을 한 번 거친다.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { format, labels, useDeleteGoal, useGoal, useUpdateGoal } from '../../client';
import {
  Button,
  Card,
  CategoryChip,
  ConfirmDialog,
  ErrorBanner,
  Icon,
  ProgressBar,
  QueryState,
  Screen,
  SectionTitle,
  StatusTag,
} from '../../components';
import { STATUS_TONE } from '../../components/StatusTag';
import Routes from '../../navigation/routes';
import { categoryStyle, colors, spacing, typography } from '../../theme';

export default function GoalDetailScreen({ navigation, route }) {
  const { goalId } = route.params ?? {};
  const [confirmDelete, setConfirmDelete] = useState(false);

  const goal = useGoal(goalId);
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();

  const togglePause = (current) =>
    updateGoal.mutate({ goalId, status: current === 'paused' ? 'active' : 'paused' });

  const remove = () =>
    deleteGoal.mutate(
      { goalId },
      {
        onSuccess: () => {
          setConfirmDelete(false);
          navigation.goBack();
        },
      },
    );

  return (
    <Screen
      title="목표 상세"
      onBack={() => navigation.goBack()}
      padded={false}
      right={
        <Button
          title="수정"
          size="sm"
          variant="text"
          onPress={() => navigation.navigate(Routes.GOAL_FORM, { goalId })}
        />
      }>
      <QueryState query={goal}>
        {(detail) => (
          <ScrollView contentContainerStyle={styles.body}>
            <ErrorBanner error={updateGoal.error ?? deleteGoal.error} />

            <Card style={styles.header}>
              <View style={styles.topRow}>
                <CategoryChip
                  categoryCode={detail.categoryCode}
                  name={detail.categoryName}
                  size="sm"
                />
                <StatusTag
                  text={labels.goalStatus[detail.status]}
                  tone={STATUS_TONE[detail.status]}
                />
              </View>

              <Text style={styles.title}>{detail.title}</Text>
              {!!detail.description && <Text style={styles.description}>{detail.description}</Text>}

              <Text style={styles.period}>
                {format.formatDate(detail.startDate)} ~ {format.formatDate(detail.endDate)}
              </Text>

              <ProgressBar
                rate={detail.progressRate}
                color={categoryStyle(detail.categoryCode).color}
                label={`진행률 ${Math.round(detail.progressRate * 100)}%`}
              />

              <View style={styles.stats}>
                <Stat label="전체 미션" value={`${detail.totalMissionCount}개`} />
                <Stat label="완료" value={`${detail.completedMissionCount}개`} />
                {detail.targetFrequency != null && (
                  <Stat label="주당 목표" value={`${detail.targetFrequency}회`} />
                )}
              </View>
            </Card>

            {!detail.hasAcceptedPlan && (
              <Card style={styles.planCard}>
                <Text style={styles.planTitle}>아직 계획이 없어요</Text>
                <Text style={styles.planText}>
                  AI가 목표를 단계로 나누고 날짜별 미션까지 만들어 드려요.
                </Text>
                <Button
                  title="AI 계획 만들기"
                  onPress={() => navigation.navigate(Routes.PLAN_GENERATING, { goalId })}
                  full
                />
              </Card>
            )}

            {detail.steps.length > 0 && (
              <View>
                <SectionTitle title="단계" />
                <View style={styles.steps}>
                  {detail.steps.map((step) => (
                    <Card key={step.id} style={[styles.step, step.isCurrent && styles.stepCurrent]}>
                      <View style={styles.stepHeader}>
                        <Text style={styles.stepNo}>{step.stepNo}단계</Text>
                        {step.isCurrent && <StatusTag text="진행 중" tone="primary" />}
                        {step.status === 'completed' && (
                          <Icon name="check" size={16} color={colors.success} strokeWidth={2.4} />
                        )}
                      </View>
                      <Text style={styles.stepTitle}>{step.title}</Text>
                      {!!step.description && (
                        <Text style={styles.stepDescription}>{step.description}</Text>
                      )}
                      <Text style={styles.stepMeta}>
                        {format.formatDate(step.dueDate)}까지 · 미션{' '}
                        {step.completedMissionCount}/{step.missionCount}
                      </Text>
                    </Card>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.actions}>
              <Button
                title={detail.status === 'paused' ? '다시 시작' : '일시정지'}
                variant="secondary"
                onPress={() => togglePause(detail.status)}
                loading={updateGoal.isPending}
                full
              />
              <Button
                title="목표 삭제"
                variant="danger"
                onPress={() => setConfirmDelete(true)}
                full
              />
            </View>
          </ScrollView>
        )}
      </QueryState>

      <ConfirmDialog
        visible={confirmDelete}
        title="목표를 삭제할까요?"
        message="아직 시작하지 않은 미션도 함께 취소돼요. 되돌릴 수 없어요."
        confirmText="삭제"
        danger
        loading={deleteGoal.isPending}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  header: { gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.title, color: colors.text },
  description: { ...typography.body, color: colors.textSub },
  period: { ...typography.caption, color: colors.textSub },
  stats: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.sm },
  stat: { gap: 2 },
  statValue: { ...typography.bodyStrong, color: colors.text },
  statLabel: { ...typography.caption, color: colors.textSub },
  planCard: { gap: spacing.sm },
  planTitle: { ...typography.bodyStrong, color: colors.text },
  planText: { ...typography.caption, color: colors.textSub, marginBottom: spacing.xs },
  steps: { gap: spacing.sm },
  step: { gap: spacing.xs },
  stepCurrent: { borderColor: colors.primary },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepNo: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  stepTitle: { ...typography.bodyStrong, color: colors.text },
  stepDescription: { ...typography.caption, color: colors.textSub },
  stepMeta: { ...typography.caption, color: colors.textSub },
  actions: { gap: spacing.sm },
});
