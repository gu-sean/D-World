// VERIFY-09 다시 찍기 안내
//
// 인증이 거절된 뒤, 무엇을 고치면 될지 알려 주고 바로 다시 찍게 한다.
//
// 거절 사유 코드(`flags`)마다 대응하는 안내를 보여 준다. 모르는 코드가 오면
// 공통 안내만 보여 주고, 사유 자체는 서버가 준 문장을 그대로 싣는다.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useMission, useRecord } from '../../client';
import { Button, Card, Icon, QueryState, Screen } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

/** 판정 사유 코드 → 다시 찍을 때 고칠 점. */
const FLAG_TIPS = {
  person_not_detected: '온몸이 화면에 들어오도록 2~3m 떨어진 곳에 기기를 세워 주세요.',
  target_not_met: '목표 횟수를 채운 뒤에 촬영을 멈춰 주세요.',
  partial_body: '머리부터 발끝까지 화면 안에 들어오게 찍어 주세요.',
  too_dark: '더 밝은 곳에서 찍어 주세요.',
  too_short: '동작을 모두 마칠 때까지 찍어 주세요.',
  camera_moved: '기기를 바닥이나 받침대에 고정해 주세요.',
  low_confidence: '동작을 천천히, 또렷하게 해 주세요.',
  // AI 영상 판정 코드 (ai/app/vision/decision.py)
  below_target: '목표 횟수를 채운 뒤에 촬영을 멈춰 주세요.',
  near_target: '거의 다 왔어요. 동작을 끝까지 크게 해 주세요.',
  low_detection: '몸이 자주 화면 밖으로 나갔어요. 조금 더 멀리서 찍어 주세요.',
  recorded_before_start: '인증 시작 버튼을 누른 뒤에 새로 찍어 주세요.',
  duplicate_media: '이미 낸 영상은 다시 쓸 수 없어요. 새로 찍어 주세요.',
  no_frames: '영상을 읽지 못했어요. 앱에서 바로 다시 찍어 주세요.',
  mock_location_detected: '모의 위치 앱을 끄고 다시 측정해 주세요.',
  gps_unstable: '건물 사이나 실내를 피하고 하늘이 보이는 곳에서 달려 주세요.',
  distance_mismatch: '중간에 멈추지 말고 한 번에 달려 주세요.',
};

const COMMON_TIPS = [
  '밝은 곳에서 기기를 고정해 두고 찍어 주세요.',
  '동작 전체가 화면에 들어오는지 미리 확인해 주세요.',
];

export default function VerifyRetryGuideScreen({ navigation, route }) {
  const { missionId, recordId } = route.params ?? {};
  const mission = useMission(missionId);
  const record = useRecord(recordId);

  const metrics = record.data?.currentResult?.metrics;
  const flags = metrics?.flags ?? [];
  // AI가 이번 영상 수치를 보고 쓴 코칭이 있으면 그것을, 없으면 판정 코드별 안내를 보여 준다
  const coaching = (metrics?.coachingTips ?? []).filter((t) => typeof t === 'string' && t);
  const tips = [...new Set(flags.map((flag) => FLAG_TIPS[flag]).filter(Boolean))];
  const shown = coaching.length > 0 ? coaching : tips.length > 0 ? tips : COMMON_TIPS;
  const byAi = coaching.length > 0 && metrics?.coachingSource === 'gemini';

  const retry = (detail) => {
    if (detail.exerciseCode === 'running') {
      navigation.replace(Routes.RUN_TRACKING, { missionId });
    } else {
      navigation.replace(Routes.VERIFY_GUIDE, { missionId });
    }
  };

  return (
    <Screen title="다시 찍기" onBack={() => navigation.goBack()} padded={false}>
      <QueryState query={mission}>
        {(detail) => (
          <>
            <ScrollView contentContainerStyle={styles.body}>
              <View style={styles.hero}>
                <Icon name="refresh" size={44} color={colors.primary} />
                <Text style={styles.heading}>다시 할 때 이렇게 해 보세요</Text>
              </View>

              {!!record.data?.currentResult?.reason && (
                <Card>
                  <Text style={styles.reasonLabel}>지난 판정 사유</Text>
                  <Text style={styles.reason}>{record.data.currentResult.reason}</Text>
                </Card>
              )}

              <Card style={styles.tips}>
                {byAi && <Text style={styles.reasonLabel}>AI 코치가 이번 영상을 보고 정리했어요</Text>}
                {shown.map((tip) => (
                  <View key={tip} style={styles.tipRow}>
                    <Icon name="check" size={14} color={colors.success} strokeWidth={2.4} />
                    <Text style={styles.tip}>{tip}</Text>
                  </View>
                ))}
              </Card>

              {!!detail.guide && (
                <Card>
                  <Text style={styles.reasonLabel}>촬영 안내</Text>
                  <Text style={styles.reason}>{detail.guide}</Text>
                </Card>
              )}

              <Text style={styles.remaining}>
                남은 제출 횟수 {detail.remainingSubmissions}회
              </Text>
            </ScrollView>

            <View style={styles.footer}>
              <Button
                title="다시 인증하기"
                onPress={() => retry(detail)}
                disabled={!detail.canStart}
                full
              />
              <Button title="나중에" variant="text" onPress={() => navigation.goBack()} full />
            </View>
          </>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  heading: { ...typography.subtitle, color: colors.text },
  reasonLabel: { ...typography.caption, color: colors.textSub, marginBottom: 2 },
  reason: { ...typography.body, color: colors.text },
  tips: { gap: spacing.sm },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  tip: { ...typography.body, color: colors.text, flex: 1 },
  remaining: { ...typography.caption, color: colors.textSub, textAlign: 'center' },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
