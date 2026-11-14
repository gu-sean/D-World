// MISSION-09 미션 상세
//
// 미션 하나의 내용과 지금 할 수 있는 일을 보여 준다.
//
// 인증 시작 버튼은 서버가 `canStart`로 알려 줄 때만 눌린다 — 오늘 미션이 아니거나
// 이미 제출했거나 제출 횟수를 다 쓴 경우를 앱이 따로 판단하지 않는다.
// 러닝 미션이면 러닝 측정 화면으로, 나머지는 촬영 안내 화면으로 간다.
//
// 이전 회차가 있으면 그 결과를 보러 갈 수 있고, 아직 시작 전이면 수정·취소할 수 있다.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { format, labels, useCancelMission, useMission } from '../../client';
import {
  Button,
  Card,
  CategoryChip,
  ConfirmDialog,
  ErrorBanner,
  Icon,
  QueryState,
  Screen,
  StatusTag,
} from '../../components';
import { STATUS_TONE } from '../../components/StatusTag';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

export default function MissionDetailScreen({ navigation, route }) {
  const { missionId } = route.params ?? {};
  const [confirmCancel, setConfirmCancel] = useState(false);

  const mission = useMission(missionId);
  const cancelMission = useCancelMission();

  const start = (detail) => {
    if (detail.exerciseCode === 'running') {
      navigation.navigate(Routes.RUN_TRACKING, { missionId });
    } else {
      navigation.navigate(Routes.VERIFY_GUIDE, { missionId });
    }
  };

  const cancel = () =>
    cancelMission.mutate(
      { missionId },
      {
        onSuccess: () => {
          setConfirmCancel(false);
          navigation.goBack();
        },
      },
    );

  return (
    <Screen title="미션" onBack={() => navigation.goBack()} padded={false}>
      <QueryState query={mission}>
        {(detail) => (
          <>
            <ScrollView contentContainerStyle={styles.body}>
              <ErrorBanner error={cancelMission.error} />

              <Card style={styles.header}>
                <View style={styles.topRow}>
                  <CategoryChip
                    categoryCode={detail.categoryCode}
                    name={detail.categoryName}
                    size="sm"
                  />
                  <StatusTag
                    text={labels.missionStatus[detail.status]}
                    tone={STATUS_TONE[detail.status]}
                  />
                </View>

                <Text style={styles.title}>{detail.title}</Text>
                {!!detail.description && (
                  <Text style={styles.description}>{detail.description}</Text>
                )}

                <View style={styles.facts}>
                  {/* 목표 값이 없는 미션(직접 만든 미션 등)은 빈 칸 대신 항목을 숨긴다 */}
                  {detail.targetValue !== null && detail.targetValue !== undefined && (
                    <Fact
                      label="목표"
                      value={format.formatTarget(detail.targetValue, detail.targetUnit)}
                    />
                  )}
                  {!!detail.estimatedDurationSeconds && (
                    <Fact
                      label="예상 시간"
                      value={format.formatSpokenDuration(detail.estimatedDurationSeconds)}
                    />
                  )}
                  <Fact label="날짜" value={format.formatDate(detail.scheduledDate)} />
                  <Fact label="인증" value={detail.exerciseCode ? '영상·센서' : '사진'} />
                </View>

                {!!detail.rewardPreview?.points && (
                  <View style={styles.rewardRow}>
                    <Icon name="coin" size={16} color={colors.warning} />
                    <Text style={styles.reward}>
                      성공하면 {format.formatPoints(detail.rewardPreview.points)} ·{' '}
                      {detail.rewardPreview.userXp} XP
                    </Text>
                  </View>
                )}
              </Card>

              {!!detail.memo && (
                <Card>
                  <Text style={styles.memoLabel}>메모</Text>
                  <Text style={styles.memo}>{detail.memo}</Text>
                </Card>
              )}

              <Card style={styles.submissions}>
                <Text style={styles.submissionText}>
                  남은 제출 횟수 {detail.remainingSubmissions}회 (최대 4회)
                </Text>
                {!!detail.latestRecord && (
                  <Button
                    title="지난 결과 보기"
                    variant="secondary"
                    size="sm"
                    onPress={() =>
                      navigation.navigate(Routes.VERIFY_RESULT, {
                        recordId: detail.latestRecord.id,
                      })
                    }
                  />
                )}
              </Card>
            </ScrollView>

            <View style={styles.footer}>
              <Button
                title={detail.exerciseCode === 'running' ? '러닝 시작' : '인증 시작'}
                onPress={() => start(detail)}
                disabled={!detail.canStart}
                full
              />
              {!detail.canStart && (
                <Text style={styles.cannotStart}>
                  지금은 시작할 수 없어요. 미션 날짜와 제출 횟수를 확인해 주세요.
                </Text>
              )}

              {detail.canEdit && (
                <View style={styles.editRow}>
                  <View style={styles.editSlot}>
                    <Button
                      title="수정"
                      variant="secondary"
                      onPress={() =>
                        // 미션 수정 화면은 홈 탭 묶음 안에 있다 (이 화면은 루트 스택)
                        navigation.navigate(Routes.MAIN, {
                          screen: Routes.HOME_TAB,
                          params: { screen: Routes.MISSION_FORM, params: { missionId } },
                        })
                      }
                      full
                    />
                  </View>
                  <View style={styles.editSlot}>
                    <Button
                      title="취소"
                      variant="text"
                      onPress={() => setConfirmCancel(true)}
                      full
                    />
                  </View>
                </View>
              )}
            </View>

            <ConfirmDialog
              visible={confirmCancel}
              title="미션을 취소할까요?"
              message="취소한 미션은 되돌릴 수 없어요."
              confirmText="취소하기"
              cancelText="그만두기"
              danger
              loading={cancelMission.isPending}
              onConfirm={cancel}
              onCancel={() => setConfirmCancel(false)}
            />
          </>
        )}
      </QueryState>
    </Screen>
  );
}

function Fact({ label, value }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  header: { gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.title, color: colors.text },
  description: { ...typography.body, color: colors.textSub },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl, marginTop: spacing.sm },
  fact: { gap: 2 },
  factLabel: { ...typography.caption, color: colors.textSub },
  factValue: { ...typography.bodyStrong, color: colors.text },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  reward: { ...typography.caption, color: colors.textSub },
  memoLabel: { ...typography.caption, color: colors.textSub, marginBottom: 2 },
  memo: { ...typography.body, color: colors.text },
  submissions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  submissionText: { ...typography.caption, color: colors.textSub, flex: 1 },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  cannotStart: { ...typography.caption, color: colors.textSub, textAlign: 'center' },
  editRow: { flexDirection: 'row', gap: spacing.sm },
  editSlot: { flex: 1 },
});
