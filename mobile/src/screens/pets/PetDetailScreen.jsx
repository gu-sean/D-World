// PET-03 펫 종류 상세
//
// 도감에서 고른 펫의 설명·성격·세계관과 세 단계의 모습, 단계별 보상 보너스를 보여 준다.
// 아직 없는 펫이고 해금돼 있으면 여기서 바로 부화로 갈 수 있다.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { labels, usePetSpeciesDetail } from '../../client';
import {
  Button,
  Card,
  CategoryChip,
  PetAvatar,
  QueryState,
  Screen,
  SectionTitle,
} from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

export default function PetDetailScreen({ navigation, route }) {
  const { speciesId } = route.params ?? {};
  const species = usePetSpeciesDetail(speciesId);

  return (
    <Screen title="펫 정보" onBack={() => navigation.goBack()} padded={false}>
      <QueryState query={species}>
        {(data) => (
          <>
            <ScrollView contentContainerStyle={styles.body}>
              <Card style={styles.head}>
                <PetAvatar
                  pet={{ imageUrl: data.stages?.[1]?.imageUrl ?? null, stageCode: 'baby' }}
                  size={110}
                />
                <Text style={styles.name}>{data.name}</Text>
                <CategoryChip categoryCode={data.categoryCode} size="sm" />
                {!!data.description && <Text style={styles.description}>{data.description}</Text>}
              </Card>

              {(!!data.personality || !!data.worldText) && (
                <Card style={styles.story}>
                  {!!data.personality && (
                    <View style={styles.storyRow}>
                      <Text style={styles.storyLabel}>성격</Text>
                      <Text style={styles.storyValue}>{data.personality}</Text>
                    </View>
                  )}
                  {!!data.worldText && (
                    <View style={styles.storyRow}>
                      <Text style={styles.storyLabel}>이야기</Text>
                      <Text style={styles.storyValue}>{data.worldText}</Text>
                    </View>
                  )}
                </Card>
              )}

              <View>
                <SectionTitle title="성장 단계" />
                <Card style={styles.stages}>
                  {(data.stages ?? []).map((stage) => (
                    <View key={stage.stageNo} style={styles.stageRow}>
                      <PetAvatar
                        pet={{ imageUrl: stage.imageUrl, stageCode: stage.stageCode }}
                        size={48}
                      />
                      <View style={styles.stageTexts}>
                        <Text style={styles.stageName}>
                          {labels.petStageCode[stage.stageCode] ?? stage.stageCode}
                        </Text>
                        <Text style={styles.stageMeta}>
                          {stage.minTotalXp} XP부터 · 보상 +{Math.round(stage.bonusRate * 100)}%
                        </Text>
                      </View>
                    </View>
                  ))}
                </Card>
              </View>

              <Card>
                <Text style={styles.hatchText}>
                  알에서 깨어나려면 미션 {data.hatchMissionCount}개를 인증해야 해요.
                </Text>
              </Card>
            </ScrollView>

            {!data.isOwned && (
              <View style={styles.footer}>
                <Button
                  title={data.isUnlocked ? '이 알 부화하기' : '아직 만날 수 없어요'}
                  onPress={() => navigation.navigate(Routes.PET_HATCH, { speciesId })}
                  disabled={!data.isUnlocked}
                  full
                />
              </View>
            )}
          </>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  head: { alignItems: 'center', gap: spacing.sm },
  name: { ...typography.title, color: colors.text },
  description: { ...typography.body, color: colors.textSub, textAlign: 'center' },
  story: { gap: spacing.sm },
  storyRow: { gap: 2 },
  storyLabel: { ...typography.caption, color: colors.textSub },
  storyValue: { ...typography.body, color: colors.text },
  stages: { gap: spacing.md },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stageTexts: { flex: 1, gap: 2 },
  stageName: { ...typography.bodyStrong, color: colors.text },
  stageMeta: { ...typography.caption, color: colors.textSub },
  hatchText: { ...typography.body, color: colors.textSub },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
