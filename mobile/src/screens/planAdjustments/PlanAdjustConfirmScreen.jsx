// BALANCE-07 적용 확인
//
// 계획을 실제로 바꾸기 전 마지막 확인. 적용하면 아직 시작하지 않은 미션이 새 계획으로
// 바뀐다는 점, 이미 끝낸 기록과 포인트는 그대로라는 점을 분명히 알려 준다.
//
// 앞 화면에서 계획을 고쳐 왔으면 `plan`이 함께 넘어오고, 그 계획으로 수락한다.
// 수락 요청은 멱등이라 중복 전송돼도 한 번만 적용된다.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAcceptAdjustment, usePlanAdjustment, useRejectAdjustment } from '../../client';
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorBanner,
  Icon,
  QueryState,
  Screen,
} from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const NOTES = [
  '아직 시작하지 않은 미션이 새 계획으로 바뀌어요.',
  '이미 인증을 끝낸 미션과 받은 포인트는 그대로 남아요.',
  '적용한 뒤에도 목표 상세에서 미션을 하나씩 손볼 수 있어요.',
];

export default function PlanAdjustConfirmScreen({ navigation, route }) {
  const { adjustmentId, plan } = route.params ?? {};
  const [askReject, setAskReject] = useState(false);

  const adjustment = usePlanAdjustment(adjustmentId);
  const accept = useAcceptAdjustment();
  const reject = useRejectAdjustment();

  const apply = () =>
    accept.mutate(
      { adjustmentId, plan: plan ?? null },
      {
        onSuccess: () =>
          navigation.replace(Routes.PLAN_ADJUST_RESULT, {
            adjustmentId,
            goalId: adjustment.data?.goalId,
          }),
      },
    );

  const decline = () =>
    reject.mutate(
      { adjustmentId },
      {
        onSuccess: () => {
          setAskReject(false);
          navigation.popToTop();
        },
      },
    );

  return (
    <Screen title="계획 바꾸기" onBack={() => navigation.goBack()} padded={false}>
      <ErrorBanner error={accept.error ?? reject.error} />

      <QueryState query={adjustment}>
        {(data) => (
          <>
            <ScrollView contentContainerStyle={styles.body}>
              <Card style={styles.summary}>
                <Text style={styles.goal}>{data.goalTitle}</Text>
                <Text style={styles.count}>
                  미션 {data.changes?.totalMissionCountBefore ?? 0}개 →{' '}
                  {plan
                    ? plan.reduce((sum, step) => sum + (step.missions?.length ?? 0), 0)
                    : (data.changes?.totalMissionCountAfter ?? 0)}
                  개
                </Text>
                {!!plan && <Text style={styles.edited}>직접 고친 계획으로 적용해요.</Text>}
              </Card>

              <Card style={styles.notes}>
                {NOTES.map((note) => (
                  <View key={note} style={styles.noteRow}>
                    <Icon name="check" size={16} color={colors.success} />
                    <Text style={styles.noteText}>{note}</Text>
                  </View>
                ))}
              </Card>
            </ScrollView>

            <View style={styles.footer}>
              <Button
                title="계획 바꾸기"
                onPress={apply}
                loading={accept.isPending}
                disabled={reject.isPending}
                full
              />
              <Button
                title="이 제안 거절하기"
                variant="text"
                onPress={() => setAskReject(true)}
                disabled={accept.isPending}
                full
              />
            </View>
          </>
        )}
      </QueryState>

      <ConfirmDialog
        visible={askReject}
        title="이 제안을 거절할까요?"
        message={'지금 계획을 그대로 쓰게 돼요.\n나중에 상황이 바뀌면 AI가 다시 제안할 수 있어요.'}
        confirmText="거절하기"
        danger
        loading={reject.isPending}
        onConfirm={decline}
        onCancel={() => setAskReject(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  summary: { gap: spacing.xs },
  goal: { ...typography.subtitle, color: colors.text },
  count: { ...typography.body, color: colors.textSub },
  edited: { ...typography.caption, color: colors.primary },
  notes: { gap: spacing.sm },
  noteRow: { flexDirection: 'row', gap: spacing.sm },
  noteText: { ...typography.body, color: colors.text, flex: 1 },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
