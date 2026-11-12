// VERIFY-06 업로드 · 분석 중
//
// 촬영이 끝난 뒤 파일을 올리고 판정을 기다리는 동안 보인다.
// 인증 흐름의 단계를 그대로 따라가며 문구를 바꾼다.
//
//   preparing   영상 준비 중      (길이·용량 확인, 압축)
//   uploading   업로드 중 n%      (실제 전송 진행률)
//   submitting  제출 중
//   waiting     AI가 확인 중
//   done        결과 화면으로 넘어감
//   pending     3분이 지나도 결과가 없음 → 알림으로 받기로 하고 빠져나감
//   error       실패 — 같은 파일로 다시 보내거나 그만두기
//
// 촬영을 취소하면 흐름이 처음 상태로 돌아가므로 이 화면도 함께 닫는다.
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useCameraVerification } from '../../client';
import { Button, ErrorBanner, Icon, ProgressBar, Screen } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const MESSAGES = {
  starting: '인증을 준비하고 있어요',
  capturing: '카메라를 열고 있어요',
  preparing: '영상을 준비하고 있어요',
  uploading: '업로드하고 있어요',
  submitting: '제출하고 있어요',
  waiting: 'AI가 확인하고 있어요',
};

export default function VerifyAnalyzingScreen({ navigation, route }) {
  const { missionId } = route.params ?? {};
  const verification = useCameraVerification(missionId);
  const { phase, progress, record, error } = verification.state;

  useEffect(() => {
    if (phase === 'done' && record?.id) {
      navigation.replace(Routes.VERIFY_RESULT, { recordId: record.id });
    }
    if (phase === 'idle') {
      navigation.goBack();
    }
  }, [phase, record?.id, navigation]);

  if (phase === 'pending') {
    return (
      <Screen title="확인 중">
        <View style={styles.wrap}>
          <Icon name="clock" size={48} color={colors.warning} />
          <Text style={styles.heading}>결과가 조금 늦어지고 있어요</Text>
          <Text style={styles.description}>
            확인이 끝나면 알림으로 알려 드릴게요. 앱을 닫아도 괜찮아요.
          </Text>
        </View>
        <View style={styles.footer}>
          <Button title="홈으로" onPress={() => navigation.navigate(Routes.HOME_TAB)} full />
        </View>
      </Screen>
    );
  }

  if (phase === 'error') {
    return (
      <Screen title="인증 실패" onBack={() => navigation.goBack()}>
        <View style={styles.wrap}>
          <ErrorBanner error={error} />
          <Icon name="alert" size={44} color={colors.danger} />
          <Text style={styles.heading}>보내지 못했어요</Text>
          <Text style={styles.description}>
            찍은 파일은 그대로 있어요. 다시 보내 볼 수 있어요.
          </Text>
        </View>
        <View style={styles.footer}>
          <Button title="다시 보내기" onPress={() => verification.retryUpload()} full />
          <Button
            title="그만두기"
            variant="text"
            onPress={() => {
              verification.cancel();
              navigation.goBack();
            }}
            full
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="인증 중">
      <View style={styles.wrap}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.heading}>{MESSAGES[phase] ?? '진행하고 있어요'}</Text>

        {phase === 'uploading' && (
          <View style={styles.progress}>
            <ProgressBar rate={progress} />
            <Text style={styles.percent}>{Math.round(progress * 100)}%</Text>
          </View>
        )}

        <Text style={styles.description}>
          화면을 닫아도 업로드는 계속돼요. 결과는 알림으로도 알려 드려요.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  heading: { ...typography.subtitle, color: colors.text, textAlign: 'center' },
  description: { ...typography.caption, color: colors.textSub, textAlign: 'center' },
  progress: { alignSelf: 'stretch', gap: spacing.xs, alignItems: 'center' },
  percent: { ...typography.caption, color: colors.textSub },
  footer: { gap: spacing.sm, paddingBottom: spacing.xl },
});
