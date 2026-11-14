// MISSION-04 목표 상세
//
// 목표 하나의 전체 모습을 보여 준다. 기간·진행률·미션 수와 단계별 로드맵이 있고,
// 지금 진행 중인 단계가 표시된다.
//
// 할 수 있는 일: 수정, 일시정지와 다시 시작, 삭제, 그리고 아직 계획이 없으면 AI 계획 만들기.
// 아래에는 이 목표의 세부 미션이 모두 나오고, 여기서 미션을 더하거나(직접·미션 틀)
// 아직 시작하지 않은 미션을 수정·취소할 수 있다.
// 세부 미션이 "주 N회"보다 적은 주가 있으면 "AI가 채워 줄까요? / 빈칸으로 두기"를 묻는다.
// 빈칸으로 두면 짧은 안내만 남고, 빈 주에는 미션이 없으니 보상도 없다.
// 삭제는 되돌릴 수 없으므로 확인 창을 한 번 거친다.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  format,
  labels,
  useCancelMission,
  useDeleteGoal,
  useFillGoalGaps,
  useGoal,
  useGoalGaps,
  useUpdateGoal,
} from '../../client';
import {
  Button,
  Card,
  CategoryChip,
  ConfirmDialog,
  ErrorBanner,
  Icon,
  ProgressRing,
  QueryState,
  Screen,
  SectionTitle,
  StatusTag,
} from '../../components';
import { STATUS_TONE } from '../../components/StatusTag';
import Routes from '../../navigation/routes';
import { categoryStyle, colors, spacing, typography } from '../../theme';
import GoalMissions from './GoalMissions';

export default function GoalDetailScreen({ navigation, route }) {
  const { goalId } = route.params ?? {};
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null); // 취소할 세부 미션

  const goal = useGoal(goalId);
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();
  const cancelMission = useCancelMission();
  const gaps = useGoalGaps(goalId);
  const fillGaps = useFillGoalGaps();
  const [gapsLater, setGapsLater] = useState(false); // "빈칸으로 두기"를 눌렀는지
  const [confirmFill, setConfirmFill] = useState(false);
  const missingCount = gaps.data?.missingCount ?? 0;
  const gapWeeks = gaps.data?.weeks ?? [];

  const fill = () =>
    fillGaps.mutate(
      { goalId },
      {
        onSuccess: () => {
          setConfirmFill(false);
          setGapsLater(false);
        },
      },
    );

  const cancel = () =>
    cancelMission.mutate(
      { missionId: cancelTarget.id },
      { onSuccess: () => setCancelTarget(null) },
    );

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
            <ErrorBanner
              error={updateGoal.error ?? deleteGoal.error ?? cancelMission.error ?? fillGaps.error}
            />

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

              <View style={styles.progressRow}>
                <ProgressRing
                  rate={detail.progressRate}
                  size={76}
                  thickness={8}
                  color={categoryStyle(detail.categoryCode).color}
                />
                <View style={styles.stats}>
                  <Stat label="전체 미션" value={`${detail.totalMissionCount}개`} />
                  <Stat label="완료" value={`${detail.completedMissionCount}개`} />
                  {detail.targetFrequency != null && (
                    <Stat label="주당 목표" value={`${detail.targetFrequency}회`} />
                  )}
                </View>
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
                        {format.formatDate(step.dueDate)}까지 · 미션 {step.completedMissionCount}/
                        {step.missionCount}
                      </Text>
                    </Card>
                  ))}
                </View>
              </View>
            )}

            {detail.status === 'active' && missingCount > 0 && !gapsLater && (
              <Card style={styles.gapCard}>
                <Text style={styles.gapTitle}>아직 세부 미션이 비어 있는 주가 있어요</Text>
                <Text style={styles.gapText}>
                  주 {gaps.data.targetFrequency}회 기준으로 {gapWeeks.length}주에 미션{' '}
                  {missingCount}개가 모자라요. 가장 가까운 주는{' '}
                  {format.formatDate(gapWeeks[0].from)} ~ {format.formatDate(gapWeeks[0].to)}이에요.
                </Text>
                <Text style={styles.gapText}>
                  AI가 채워 줄까요, 아니면 빈칸으로 두고 나중에 적을까요?
                </Text>
                <View style={styles.addRow}>
                  <View style={styles.addSlot}>
                    <Button
                      title="AI가 채워 주기"
                      size="sm"
                      onPress={() => setConfirmFill(true)}
                      full
                    />
                  </View>
                  <View style={styles.addSlot}>
                    <Button
                      title="빈칸으로 두기"
                      size="sm"
                      variant="secondary"
                      onPress={() => setGapsLater(true)}
                      full
                    />
                  </View>
                </View>
              </Card>
            )}

            <View>
              <SectionTitle title="세부 미션" />
              {detail.status === 'active' && missingCount > 0 && gapsLater && (
                <Button
                  title={`빈 주 ${gapWeeks.length}개 · AI로 채우기`}
                  size="sm"
                  variant="text"
                  onPress={() => setConfirmFill(true)}
                />
              )}
              <Card style={styles.missionsCard}>
                <GoalMissions
                  goalId={goalId}
                  onOpenMission={(missionId) =>
                    navigation.navigate(Routes.MISSION_DETAIL, { missionId })
                  }
                  onEdit={(missionId) => navigation.navigate(Routes.MISSION_FORM, { missionId })}
                  onCancel={setCancelTarget}
                />
                {['active', 'paused'].includes(detail.status) && (
                  <View style={styles.addRow}>
                    <View style={styles.addSlot}>
                      <Button
                        title="직접 추가"
                        size="sm"
                        variant="secondary"
                        onPress={() => navigation.navigate(Routes.MISSION_FORM, { goalId })}
                        full
                      />
                    </View>
                    <View style={styles.addSlot}>
                      <Button
                        title="미션 틀에서 고르기"
                        size="sm"
                        variant="secondary"
                        onPress={() => navigation.navigate(Routes.MISSION_CATALOG, { goalId })}
                        full
                      />
                    </View>
                  </View>
                )}
              </Card>
            </View>

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

      <ConfirmDialog
        visible={confirmFill}
        title="빈 주를 채울까요?"
        message={`비어 있는 ${gapWeeks.length}주에 미션 ${missingCount}개를 만들어요. 난이도와 보상은 미션마다 정해지고, 만든 뒤에도 수정·취소할 수 있어요.`}
        confirmText="채우기"
        cancelText="그만두기"
        loading={fillGaps.isPending}
        onConfirm={fill}
        onCancel={() => setConfirmFill(false)}
      />

      <ConfirmDialog
        visible={Boolean(cancelTarget)}
        title="세부 미션을 취소할까요?"
        message={`${cancelTarget?.title ?? ''}\n취소한 미션은 되돌릴 수 없어요.`}
        confirmText="취소하기"
        cancelText="그만두기"
        danger
        loading={cancelMission.isPending}
        onConfirm={cancel}
        onCancel={() => setCancelTarget(null)}
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
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  stats: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
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
  missionsCard: { gap: spacing.sm },
  gapCard: { gap: spacing.sm, borderColor: colors.primary },
  gapTitle: { ...typography.bodyStrong, color: colors.text },
  gapText: { ...typography.caption, color: colors.textSub },
  addRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  addSlot: { flex: 1 },
  actions: { gap: spacing.sm },
});
