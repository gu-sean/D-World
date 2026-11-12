// VERIFY-07·08 인증 결과
//
// 한 회차의 판정 결과를 보여 준다. 결과는 세 갈래다.
//
//   approved         성공. 받은 보상을 보여 주고 완료 화면으로 넘어갈 수 있다
//   rejected         실패. 사유와 자세 문제 구간, 남은 제출 횟수, 이의 제기 버튼
//   review_required  관리자가 확인 중. 성공이 아니므로 보상을 보여 주지 않는다
//
// 아직 판정 전이면 조회 훅이 2초마다 다시 물어보므로 기다리기만 하면 된다.
// 이의 제기는 거절된 현재 판정에만, 통보 뒤 7일 안에 할 수 있다 — 가능 여부는
// 서버가 `canAppeal`로 알려 준다.
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { format, labels, useAppeal, useRecord, validators } from '../../client';
import {
  Button,
  Card,
  ErrorBanner,
  Icon,
  QueryState,
  RewardSummary,
  Screen,
  StatusTag,
  TextField,
} from '../../components';
import { STATUS_TONE } from '../../components/StatusTag';
import Routes from '../../navigation/routes';
import { colors, radius, spacing, typography } from '../../theme';

/** 측정값 중 사람이 읽을 만한 것만 골라 줄로 만든다. */
function metricRows(metrics) {
  if (!metrics) return [];
  const rows = [];
  if (metrics.validRepCount != null) rows.push(['인정된 횟수', `${metrics.validRepCount}회`]);
  if (metrics.invalidRepCount) rows.push(['인정 안 된 횟수', `${metrics.invalidRepCount}회`]);
  if (metrics.holdSeconds != null)
    rows.push(['유지 시간', format.formatSpokenDuration(metrics.holdSeconds)]);
  if (metrics.distanceMeters != null)
    rows.push(['거리', format.formatDistance(metrics.distanceMeters)]);
  if (metrics.activeSeconds != null)
    rows.push(['움직인 시간', format.formatDuration(metrics.activeSeconds)]);
  if (metrics.avgPaceSecondsPerKm != null)
    rows.push(['평균 페이스', `${format.formatDuration(metrics.avgPaceSecondsPerKm)} /km`]);
  if (metrics.steps != null) rows.push(['걸음 수', format.formatNumber(metrics.steps)]);
  return rows;
}

export default function VerifyResultScreen({ navigation, route }) {
  const { recordId } = route.params ?? {};
  const [appealOpen, setAppealOpen] = useState(false);
  const [reason, setReason] = useState('');

  const record = useRecord(recordId);
  const appeal = useAppeal();

  const reasonCheck = validators.validateLength(reason, 'appealReason');

  const submitAppeal = (resultId) =>
    appeal.mutate(
      { resultId, reason: reason.trim() },
      {
        onSuccess: () => {
          setAppealOpen(false);
          setReason('');
          record.refetch();
        },
      },
    );

  return (
    <Screen title="인증 결과" onBack={() => navigation.goBack()} padded={false}>
      <QueryState query={record}>
        {(data) => {
          const result = data.currentResult;
          const decision = result?.decision;
          const approved = decision === 'approved';
          const rejected = decision === 'rejected';
          const reviewing = decision === 'review_required';
          const rows = metricRows(result?.metrics);

          return (
            <>
              <ScrollView contentContainerStyle={styles.body}>
                <View style={styles.hero}>
                  <Icon
                    name={approved ? 'check' : rejected ? 'close' : 'clock'}
                    size={52}
                    color={approved ? colors.success : rejected ? colors.danger : colors.warning}
                    strokeWidth={2.4}
                  />
                  <Text style={styles.heading}>
                    {approved ? '인증에 성공했어요' : rejected ? '인증하지 못했어요' : '확인하고 있어요'}
                  </Text>
                  <StatusTag
                    text={labels.recordStatus[data.status]}
                    tone={STATUS_TONE[data.status]}
                  />
                </View>

                {!!result?.reason && (
                  <Card>
                    <Text style={styles.reasonLabel}>
                      {result.source === 'admin' ? '관리자 확인 결과' : 'AI 판정 사유'}
                    </Text>
                    <Text style={styles.reason}>{result.reason}</Text>
                  </Card>
                )}

                {reviewing && (
                  <Card>
                    <Text style={styles.reviewText}>
                      자동으로 판단하기 어려워 관리자가 직접 확인하고 있어요.
                      결과가 나오면 알림으로 알려 드릴게요.
                    </Text>
                  </Card>
                )}

                {approved && <RewardSummary rewards={data.rewards} />}

                {rows.length > 0 && (
                  <Card style={styles.metrics}>
                    <Text style={styles.metricsLabel}>측정값</Text>
                    {rows.map(([label, value]) => (
                      <View key={label} style={styles.metricRow}>
                        <Text style={styles.metricLabel}>{label}</Text>
                        <Text style={styles.metricValue}>{value}</Text>
                      </View>
                    ))}
                  </Card>
                )}

                {(result?.metrics?.issues ?? []).length > 0 && (
                  <Card style={styles.issues}>
                    <Text style={styles.metricsLabel}>자세를 확인해 볼 구간</Text>
                    {result.metrics.issues.map((issue, index) => (
                      <Text key={`${issue.code}-${index}`} style={styles.issue}>
                        {format.formatDuration(Math.round(issue.startSec))} ~{' '}
                        {format.formatDuration(Math.round(issue.endSec))}
                      </Text>
                    ))}
                  </Card>
                )}

                {rejected && (
                  <Text style={styles.remaining}>
                    남은 제출 횟수 {data.mission?.remainingSubmissions ?? 0}회
                  </Text>
                )}
              </ScrollView>

              <View style={styles.footer}>
                {approved && (
                  <Button
                    title="보상 확인하기"
                    onPress={() => navigation.replace(Routes.MISSION_COMPLETE, { recordId })}
                    full
                  />
                )}

                {rejected && (
                  <>
                    <Button
                      title="다시 찍는 방법 보기"
                      onPress={() =>
                        navigation.navigate(Routes.VERIFY_RETRY_GUIDE, {
                          missionId: data.missionId,
                          recordId,
                        })
                      }
                      full
                    />
                    {data.canAppeal && (
                      <Button
                        title="이의 제기"
                        variant="secondary"
                        onPress={() => setAppealOpen(true)}
                        full
                      />
                    )}
                  </>
                )}

                {reviewing && (
                  <Button title="홈으로" onPress={() => navigation.navigate(Routes.HOME_TAB)} full />
                )}
              </View>

              <Modal visible={appealOpen} transparent animationType="slide">
                <View style={styles.modalBackdrop}>
                  <View style={styles.modalCard}>
                    <Text style={styles.modalTitle}>이의 제기</Text>
                    <Text style={styles.modalText}>
                      왜 다시 봐야 하는지 적어 주세요. 관리자가 영상을 다시 확인해요.
                    </Text>

                    <ErrorBanner error={appeal.error} />

                    <TextField
                      value={reason}
                      onChangeText={setReason}
                      placeholder="예) 스쿼트 20개를 모두 했는데 절반만 인정됐어요."
                      multiline
                      maxLength={500}
                      error={reason.length > 0 && !reasonCheck.ok ? reasonCheck.message : null}
                    />

                    <View style={styles.modalButtons}>
                      <View style={styles.modalSlot}>
                        <Button
                          title="취소"
                          variant="secondary"
                          onPress={() => setAppealOpen(false)}
                          full
                        />
                      </View>
                      <View style={styles.modalSlot}>
                        <Button
                          title="보내기"
                          onPress={() => submitAppeal(result?.id)}
                          loading={appeal.isPending}
                          disabled={!reasonCheck.ok}
                          full
                        />
                      </View>
                    </View>
                  </View>
                </View>
              </Modal>
            </>
          );
        }}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  heading: { ...typography.title, color: colors.text, textAlign: 'center' },
  reasonLabel: { ...typography.caption, color: colors.textSub, marginBottom: 2 },
  reason: { ...typography.body, color: colors.text },
  reviewText: { ...typography.body, color: colors.textSub },
  metrics: { gap: spacing.xs },
  metricsLabel: { ...typography.caption, color: colors.textSub, marginBottom: spacing.xs },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metricLabel: { ...typography.body, color: colors.textSub },
  metricValue: { ...typography.bodyStrong, color: colors.text },
  issues: { gap: spacing.xs },
  issue: { ...typography.caption, color: colors.textSub },
  remaining: { ...typography.caption, color: colors.textSub, textAlign: 'center' },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 20, 28, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  modalTitle: { ...typography.subtitle, color: colors.text },
  modalText: { ...typography.caption, color: colors.textSub },
  modalButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  modalSlot: { flex: 1 },
});
