// MY-11 회원 탈퇴
//
// 탈퇴하면 무엇이 사라지는지 먼저 다 알려 주고, 사용자가 안내를 확인했다고
// 표시한 뒤에야 신청 버튼이 열린다.
//
// 신청이 받아들여지면 서버가 모든 세션을 끊으므로 앱은 곧바로 로그인 화면으로
// 돌아간다 — 기능 모듈이 세션을 정리해 주고, 이 화면은 결과만 알린다.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { useRequestWithdrawal, validators } from '../../client';
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorBanner,
  Icon,
  Screen,
  TextField,
} from '../../components';
import { colors, spacing, typography } from '../../theme';

const LOSSES = [
  '목표·미션 기록과 인증 사진·영상이 모두 지워져요.',
  '모은 포인트와 상점에서 바꾼 물건은 돌려받을 수 없어요.',
  '키운 펫과 받은 업적·배지도 함께 사라져요.',
  '참여 중인 챌린지에서 빠지고 보상을 받을 수 없어요.',
  '같은 휴대폰 번호로 다시 가입해도 기록은 되살아나지 않아요.',
];

export default function WithdrawalScreen({ navigation }) {
  const [agreed, setAgreed] = useState(false);
  const [reason, setReason] = useState('');
  const [asking, setAsking] = useState(false);

  const withdraw = useRequestWithdrawal();

  const reasonCheck = validators.validateLength(reason, 'withdrawalReason');

  const send = () =>
    withdraw.mutate(
      { reason: reason.trim() || null },
      { onSuccess: () => setAsking(false) },
    );

  return (
    <Screen title="회원 탈퇴" onBack={() => navigation.goBack()} padded={false}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <ErrorBanner error={withdraw.error} />

        <View style={styles.hero}>
          <Icon name="alert" size={40} color={colors.danger} />
          <Text style={styles.heading}>탈퇴하면 되돌릴 수 없어요</Text>
        </View>

        <Card style={styles.lossCard}>
          {LOSSES.map((loss) => (
            <View key={loss} style={styles.lossRow}>
              <Icon name="close" size={14} color={colors.danger} strokeWidth={2.4} />
              <Text style={styles.lossText}>{loss}</Text>
            </View>
          ))}
        </Card>

        <TextField
          label="탈퇴 이유 (선택)"
          value={reason}
          onChangeText={setReason}
          placeholder="불편했던 점을 알려 주시면 고치는 데 쓸게요."
          multiline
          maxLength={500}
          error={!reasonCheck.ok ? reasonCheck.message : null}
        />

        <Card style={styles.agreeCard}>
          <Text style={styles.agreeText}>위 내용을 모두 확인했어요</Text>
          <Switch value={agreed} onValueChange={setAgreed} />
        </Card>

        <Button
          title="탈퇴 신청하기"
          variant="danger"
          onPress={() => setAsking(true)}
          disabled={!agreed || !reasonCheck.ok}
          full
        />

        <Text style={styles.note}>
          신청하면 바로 로그아웃되고, 실제 삭제는 운영팀 확인 뒤에 처리돼요.
        </Text>
      </ScrollView>

      <ConfirmDialog
        visible={asking}
        title="정말 탈퇴할까요?"
        message="지금까지의 기록과 보상이 모두 사라져요."
        confirmText="탈퇴하기"
        danger
        loading={withdraw.isPending}
        onConfirm={send}
        onCancel={() => setAsking(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md },
  heading: { ...typography.title, color: colors.text, textAlign: 'center' },
  lossCard: { gap: spacing.sm },
  lossRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  lossText: { ...typography.body, color: colors.text, flex: 1 },
  agreeCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  agreeText: { ...typography.body, color: colors.text, flex: 1 },
  note: { ...typography.caption, color: colors.textSub, textAlign: 'center' },
});
