// PET-01 펫 방
//
// 대표 펫을 크게 보여 주고, 지금 시간대에 맞는 대사와 성장 정도를 알려 준다.
// 알 단계면 부화까지 남은 미션 수가, 그 뒤로는 다음 단계까지 남은 경험치가 보인다.
//
// 아래에는 함께 있는 다른 펫들이 줄지어 있고, 누르면 대표 펫을 바꾼다.
// 펫이 하나도 없으면 도감에서 알을 고르러 갈 수 있다.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { format, labels, useMyPets, useSetRepresentativePet } from '../../client';
import {
  Button,
  Card,
  ErrorBanner,
  PetAvatar,
  ProgressBar,
  QueryState,
  Screen,
  SectionTitle,
  StatusTag,
} from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

export default function PetRoomScreen({ navigation }) {
  const pets = useMyPets();
  const setRepresentative = useSetRepresentativePet();

  const list = pets.data ?? [];
  const main = list.find((pet) => pet.isRepresentative) ?? list[0] ?? null;
  const others = list.filter((pet) => pet.id !== main?.id);

  return (
    <Screen
      title="펫"
      onBack={() => navigation.goBack()}
      padded={false}
      right={
        <Button
          title="도감"
          size="sm"
          variant="text"
          onPress={() => navigation.navigate(Routes.PET_COLLECTION)}
        />
      }>
      <QueryState
        query={pets}
        isEmpty={list.length === 0}
        emptyTitle="아직 함께하는 펫이 없어요"
        emptyText="도감에서 마음에 드는 알을 골라 보세요.">
        {() => (
          <ScrollView contentContainerStyle={styles.body}>
            <ErrorBanner error={setRepresentative.error} />

            <Card style={styles.mainCard}>
              <PetAvatar pet={main} size={120} />
              <Text style={styles.nickname}>{main.nickname}</Text>
              <Text style={styles.species}>
                {main.speciesName} · {labels.petStageCode[main.stageCode]} · Lv.{main.levelNo}
              </Text>

              {!!main.dialogue && (
                <View style={styles.bubble}>
                  <Text style={styles.dialogue}>{main.dialogue}</Text>
                </View>
              )}

              {main.hatchProgress ? (
                <View style={styles.progressBox}>
                  <ProgressBar
                    rate={main.hatchProgress.done / Math.max(1, main.hatchProgress.required)}
                    label={`부화까지 미션 ${main.hatchProgress.done}/${main.hatchProgress.required}`}
                  />
                </View>
              ) : (
                <View style={styles.progressBox}>
                  <ProgressBar
                    rate={main.nextStageXp ? main.totalXp / main.nextStageXp : 1}
                    label={
                      main.nextStageXp
                        ? `다음 단계까지 ${format.formatNumber(main.nextStageXp - main.totalXp)} XP`
                        : '마지막 단계예요'
                    }
                  />
                </View>
              )}

              <StatusTag
                text={`보상 보너스 +${Math.round(main.bonusRate * 100)}%`}
                tone="primary"
              />
            </Card>

            {others.length > 0 && (
              <View>
                <SectionTitle title="함께 있는 펫" />
                <View style={styles.others}>
                  {others.map((pet) => (
                    <Card
                      key={pet.id}
                      onPress={() => setRepresentative.mutate({ petId: pet.id })}
                      style={styles.otherCard}>
                      <PetAvatar pet={pet} size={56} />
                      <Text style={styles.otherName} numberOfLines={1}>
                        {pet.nickname}
                      </Text>
                      <Text style={styles.otherStage}>{labels.petStageCode[pet.stageCode]}</Text>
                    </Card>
                  ))}
                </View>
                <Text style={styles.hint}>펫을 누르면 대표 펫이 바뀌어요.</Text>
              </View>
            )}

            <Button
              title="새 알 부화하기"
              variant="secondary"
              onPress={() => navigation.navigate(Routes.PET_HATCH)}
              full
            />
          </ScrollView>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  mainCard: { alignItems: 'center', gap: spacing.sm },
  nickname: { ...typography.title, color: colors.text },
  species: { ...typography.caption, color: colors.textSub },
  bubble: {
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  dialogue: { ...typography.body, color: colors.text, textAlign: 'center' },
  progressBox: { alignSelf: 'stretch', marginTop: spacing.xs },
  others: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  otherCard: { alignItems: 'center', gap: spacing.xs, width: 100, padding: spacing.md },
  otherName: { ...typography.caption, color: colors.text },
  otherStage: { ...typography.caption, color: colors.textSub },
  hint: { ...typography.caption, color: colors.textSub, marginTop: spacing.sm },
});
