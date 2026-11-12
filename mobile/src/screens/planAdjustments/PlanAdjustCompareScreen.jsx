// BALANCE-05 계획 비교
//
// 지금 쓰는 계획과 AI가 제안한 계획을 위아래로 놓고 무엇이 달라지는지 보여 준다.
// 주 미션 수·전체 미션 수·주당 쉬는 날·목표량 변화는 서버가 계산해 둔 요약(`changes`)을
// 그대로 쓴다. 두 계획 중 하나를 눌러 바로 고를 수 있다.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { format, usePlanAdjustment } from '../../client';
import { Button, Card, PlanStepList, QueryState, Screen } from '../../components';
import Routes from '../../navigation/routes';
import { colors, radius, spacing, typography } from '../../theme';

/** 요약 한 줄: 라벨 / 바뀌기 전 / 바뀐 후 */
function DiffRow({ label, before, after }) {
  const changed = String(before) !== String(after);
  return (
    <View style={styles.diffRow}>
      <Text style={styles.diffLabel}>{label}</Text>
      <Text style={styles.diffBefore}>{before}</Text>
      <Text style={[styles.diffAfter, changed && styles.diffAfterChanged]}>→ {after}</Text>
    </View>
  );
}

export default function PlanAdjustCompareScreen({ navigation, route }) {
  const { adjustmentId } = route.params ?? {};
  const [side, setSide] = useState('after');
  const adjustment = usePlanAdjustment(adjustmentId);

  return (
    <Screen title="계획 비교" onBack={() => navigation.goBack()} padded={false}>
      <QueryState query={adjustment}>
        {(data) => {
          const changes = data.changes ?? {};
          const steps = side === 'after' ? data.proposedPlan : data.beforePlan;

          return (
            <>
              <ScrollView contentContainerStyle={styles.body}>
                <Card style={styles.changes}>
                  <Text style={styles.changesLabel}>무엇이 달라지나요</Text>
                  <DiffRow
                    label="주 미션 수"
                    before={`${changes.weeklyMissionCountBefore ?? 0}개`}
                    after={`${changes.weeklyMissionCountAfter ?? 0}개`}
                  />
                  <DiffRow
                    label="전체 미션 수"
                    before={`${changes.totalMissionCountBefore ?? 0}개`}
                    after={`${changes.totalMissionCountAfter ?? 0}개`}
                  />
                  <DiffRow
                    label="주당 쉬는 날"
                    before={`${changes.restDaysPerWeekBefore ?? 0}일`}
                    after={`${changes.restDaysPerWeekAfter ?? 0}일`}
                  />
                  {typeof changes.totalTargetChangeRate === 'number' && (
                    <Text style={styles.targetChange}>
                      전체 목표량 {format.formatRate(Math.abs(changes.totalTargetChangeRate))}{' '}
                      {changes.totalTargetChangeRate < 0 ? '줄어요' : '늘어요'}
                    </Text>
                  )}
                </Card>

                <View style={styles.tabs}>
                  <Pressable
                    style={[styles.tab, side === 'before' && styles.tabOn]}
                    onPress={() => setSide('before')}>
                    <Text style={[styles.tabText, side === 'before' && styles.tabTextOn]}>
                      지금 계획
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.tab, side === 'after' && styles.tabOn]}
                    onPress={() => setSide('after')}>
                    <Text style={[styles.tabText, side === 'after' && styles.tabTextOn]}>
                      새 계획
                    </Text>
                  </Pressable>
                </View>

                <PlanStepList steps={steps} compact />
              </ScrollView>

              <View style={styles.footer}>
                <Button
                  title="새 계획으로 바꾸기"
                  onPress={() => navigation.navigate(Routes.PLAN_ADJUST_CONFIRM, { adjustmentId })}
                  full
                />
                <Button
                  title="지금 계획 그대로 두기"
                  variant="text"
                  onPress={() => navigation.goBack()}
                  full
                />
              </View>
            </>
          );
        }}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  changes: { gap: spacing.xs },
  changesLabel: { ...typography.caption, color: colors.textSub },
  diffRow: { flexDirection: 'row', alignItems: 'center' },
  diffLabel: { ...typography.body, color: colors.text, flex: 1 },
  diffBefore: { ...typography.body, color: colors.textSub },
  diffAfter: { ...typography.body, color: colors.textSub, width: 72, textAlign: 'right' },
  diffAfterChanged: { color: colors.primary, fontWeight: '600' },
  targetChange: { ...typography.caption, color: colors.textSub, marginTop: spacing.xs },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  tabOn: { backgroundColor: colors.surface },
  tabText: { ...typography.body, color: colors.textSub },
  tabTextOn: { color: colors.text, fontWeight: '600' },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
