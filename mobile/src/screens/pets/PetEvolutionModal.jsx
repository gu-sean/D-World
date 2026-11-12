// PET-05 펫 진화 알림
//
// 펫이 다음 단계로 자랐을 때 위에 떠서 축하한다.
// 어느 단계에서 어느 단계로 갔는지, 보상 보너스가 얼마나 올랐는지,
// 새로 생긴 대사는 무엇인지 보여 준다.
//
// 아직 못 본 진화 기록을 서버에서 받아 가장 최근 것을 띄운다.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { labels, usePetEvolutionEvents } from '../../client';
import { Button, Icon, PetAvatar } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';

export default function PetEvolutionModal({ navigation, route }) {
  const { petId, since } = route.params ?? {};
  const events = usePetEvolutionEvents(petId, since);
  const latest = (events.data ?? []).at(-1) ?? null;

  const close = () => navigation.goBack();

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Icon name="star" size={34} color={colors.warning} />
        <Text style={styles.heading}>펫이 자랐어요!</Text>

        <PetAvatar pet={{ stageCode: latest?.toStageCode }} size={96} />

        {!!latest && (
          <>
            <Text style={styles.stage}>
              {labels.petStageCode[latest.fromStageCode]} →{' '}
              {labels.petStageCode[latest.toStageCode]}
            </Text>
            <Text style={styles.bonus}>
              보상 보너스 {Math.round(latest.bonusRateBefore * 100)}% →{' '}
              {Math.round(latest.bonusRateAfter * 100)}%
            </Text>

            {(latest.newDialogues ?? []).slice(0, 1).map((line) => (
              <View key={line} style={styles.bubble}>
                <Text style={styles.dialogue}>{line}</Text>
              </View>
            ))}
          </>
        )}

        <Button title="확인" onPress={close} full />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 20, 28, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  heading: { ...typography.title, color: colors.text },
  stage: { ...typography.bodyStrong, color: colors.text },
  bonus: { ...typography.caption, color: colors.textSub },
  bubble: {
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginVertical: spacing.xs,
  },
  dialogue: { ...typography.body, color: colors.text, textAlign: 'center' },
});
