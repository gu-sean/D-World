// VERIFY-03 촬영 안내
//
// 찍기 전에 어떻게 찍어야 하는지 알려 준다. 운동별 안내 문구는 서버가 미션 상세로
// 내려 주는 값을 그대로 쓴다 — 앱이 운동마다 문구를 가지고 있지 않다.
//
// "촬영 시작"을 누르면 카메라 권한부터 확인하고, 허용돼 있으면 인증 흐름을 시작하면서
// 분석 화면으로 넘어간다. 흐름 자체는 화면 밖에 있어서 이 화면을 떠나도 멈추지 않는다.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { permissions, useCameraVerification, useMission } from '../../client';
import { Button, Card, Icon, QueryState, Screen } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

/** 어떤 미션이든 공통으로 지키면 좋은 것들. */
const COMMON_TIPS = [
  '밝은 곳에서 찍어 주세요.',
  '기기를 고정해 두고 움직이지 않게 해 주세요.',
  '영상은 2분까지 찍을 수 있어요.',
];

export default function VerifyGuideScreen({ navigation, route }) {
  const { missionId } = route.params ?? {};
  const mission = useMission(missionId);
  const verification = useCameraVerification(missionId);

  const start = async (detail) => {
    const status = await permissions.check('camera');
    if (status !== 'granted') {
      navigation.navigate(Routes.VERIFY_PERMISSION, { missionId, kind: 'camera' });
      return;
    }
    verification.start({ exerciseCode: detail.exerciseCode ?? null });
    navigation.replace(Routes.VERIFY_ANALYZING, { missionId });
  };

  return (
    <Screen title="인증 준비" onBack={() => navigation.goBack()} padded={false}>
      <QueryState query={mission}>
        {(detail) => (
          <>
            <ScrollView contentContainerStyle={styles.body}>
              <View style={styles.hero}>
                <Icon name="camera" size={44} color={colors.primary} />
                <Text style={styles.title}>{detail.title}</Text>
                <Text style={styles.subtitle}>
                  {detail.exerciseCode ? '영상으로 인증해요' : '사진으로 인증해요'}
                </Text>
              </View>

              {!!detail.guide && (
                <Card style={styles.guideCard}>
                  <Text style={styles.guideLabel}>이렇게 찍어 주세요</Text>
                  <Text style={styles.guide}>{detail.guide}</Text>
                </Card>
              )}

              <Card style={styles.tips}>
                {COMMON_TIPS.map((tip) => (
                  <View key={tip} style={styles.tipRow}>
                    <Icon name="check" size={14} color={colors.success} strokeWidth={2.4} />
                    <Text style={styles.tip}>{tip}</Text>
                  </View>
                ))}
              </Card>

              <Text style={styles.remaining}>
                남은 제출 횟수 {detail.remainingSubmissions}회
              </Text>
            </ScrollView>

            <View style={styles.footer}>
              <Button
                title={detail.exerciseCode ? '촬영 시작' : '사진 찍기'}
                onPress={() => start(detail)}
                disabled={!detail.canStart}
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
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg },
  title: { ...typography.title, color: colors.text, textAlign: 'center' },
  subtitle: { ...typography.caption, color: colors.textSub },
  guideCard: { gap: spacing.xs },
  guideLabel: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  guide: { ...typography.body, color: colors.text },
  tips: { gap: spacing.sm },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  tip: { ...typography.caption, color: colors.textSub, flex: 1 },
  remaining: { ...typography.caption, color: colors.textSub, textAlign: 'center' },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
