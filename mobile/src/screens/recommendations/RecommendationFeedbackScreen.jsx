// SITUATION-09 추천 거절
//
// 추천이 마음에 들지 않을 때 거절하는 화면. 거절 사유는 서버가 받지 않으므로
// 고른 이유는 화면 안내에만 쓰고, 서버에는 거절만 보낸다.
//
// 거절한 추천은 다시 뜨지 않으므로 한 번 더 확인한 뒤 보낸다.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useDismissRecommendation } from '../../client';
import { Button, Card, ErrorBanner, Icon, OptionRow, Screen } from '../../components';
import { colors, spacing, typography } from '../../theme';

const REASONS = [
  { value: 'too_hard', label: '너무 힘들어요' },
  { value: 'not_now', label: '지금은 어려워요' },
  { value: 'not_interested', label: '관심 없어요' },
];

const FOLLOW_UP = {
  too_hard: '다음에는 더 가벼운 미션을 찾아 드릴게요.',
  not_now: '시간이 날 때 다시 추천받아 보세요.',
  not_interested: '목표를 더 추가하면 추천이 더 잘 맞아요.',
};

export default function RecommendationFeedbackScreen({ navigation, route }) {
  const { recommendationId } = route.params ?? {};
  const [reason, setReason] = useState(null);

  const dismiss = useDismissRecommendation();

  const send = () =>
    dismiss.mutate({ recommendationId }, { onSuccess: () => navigation.popToTop() });

  return (
    <Screen title="추천 거절" onBack={() => navigation.goBack()}>
      <ErrorBanner error={dismiss.error} />

      <View style={styles.wrap}>
        <Icon name="close" size={40} color={colors.textSub} />
        <Text style={styles.heading}>이 추천을 지울까요?</Text>
        <Text style={styles.description}>
          지운 추천은 다시 보이지 않아요.{'\n'}이유를 골라 주시면 다음 추천에 참고해요.
        </Text>

        <View style={styles.options}>
          <OptionRow options={REASONS} value={reason} onChange={setReason} />
        </View>

        {!!reason && (
          <Card style={styles.followUp}>
            <Text style={styles.followUpText}>{FOLLOW_UP[reason]}</Text>
          </Card>
        )}
      </View>

      <View style={styles.footer}>
        <Button
          title="추천 지우기"
          variant="danger"
          onPress={send}
          loading={dismiss.isPending}
          full
        />
        <Button title="그냥 두기" variant="text" onPress={() => navigation.goBack()} full />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  heading: { ...typography.title, color: colors.text, textAlign: 'center' },
  description: { ...typography.body, color: colors.textSub, textAlign: 'center' },
  options: { alignSelf: 'stretch', marginTop: spacing.md },
  followUp: { alignSelf: 'stretch' },
  followUpText: { ...typography.caption, color: colors.textSub },
  footer: { gap: spacing.sm, paddingBottom: spacing.xl },
});
