// PET-02 펫 도감
//
// 만날 수 있는 펫 종류를 격자로 보여 준다. 아직 해금되지 않은 펫은 흐리게 표시하고
// 어떤 조건을 채워야 하는지와 지금 얼마나 왔는지를 함께 알려 준다.
//
// 분야로 걸러 볼 수 있고, 하나를 누르면 상세로 간다.
import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { useGoalCategories, usePetSpecies } from '../../client';
import {
  Card,
  CategoryChip,
  OptionRow,
  PetAvatar,
  QueryState,
  Screen,
  StatusTag,
} from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

/** 해금 조건을 한 줄 문장으로. 조건 종류는 07 §12의 값을 따른다. */
function unlockText(condition) {
  if (!condition) return '';
  const { type, targetCount, achievementTitle, progressCount } = condition;
  switch (type) {
    case 'none':
      return '바로 만날 수 있어요';
    case 'approved_mission_count':
      return `미션 ${progressCount}/${targetCount}개 인증하면 열려요`;
    case 'category_approved_mission_count':
      return `이 분야 미션 ${progressCount}/${targetCount}개 인증하면 열려요`;
    case 'streak_milestone':
      return `${targetCount}일 연속 달성하면 열려요`;
    case 'achievement_earned':
      return `업적 "${achievementTitle}"을 얻으면 열려요`;
    default:
      return '';
  }
}

export default function PetCollectionScreen({ navigation }) {
  const [categoryCode, setCategoryCode] = useState(null);
  const categories = useGoalCategories();
  const species = usePetSpecies(categoryCode ? { categoryCode } : {});

  const options = useMemo(
    () => [
      { value: null, label: '전체' },
      ...(categories.data ?? []).map((c) => ({ value: c.code, label: c.name })),
    ],
    [categories.data],
  );

  return (
    <Screen title="펫 도감" onBack={() => navigation.goBack()} padded={false}>
      <View style={styles.filter}>
        <OptionRow options={options} value={categoryCode} onChange={setCategoryCode} />
      </View>

      <QueryState query={species} emptyTitle="보여 줄 펫이 없어요">
        {(items) => (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Card
                onPress={() => navigation.navigate(Routes.PET_DETAIL, { speciesId: item.id })}
                style={[styles.card, !item.isUnlocked && styles.locked]}>
                <PetAvatar
                  pet={{ imageUrl: item.stages?.[1]?.imageUrl ?? null, stageCode: 'baby' }}
                  size={72}
                />
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <CategoryChip categoryCode={item.categoryCode} size="sm" />

                {item.isOwned ? (
                  <StatusTag text="함께하는 중" tone="success" />
                ) : item.isUnlocked ? (
                  <StatusTag text="만날 수 있어요" tone="primary" />
                ) : (
                  <Text style={styles.unlock} numberOfLines={2}>
                    {unlockText(item.unlockCondition)}
                  </Text>
                )}
              </Card>
            )}
          />
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filter: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  row: { gap: spacing.sm },
  card: { flex: 1, alignItems: 'center', gap: spacing.xs, padding: spacing.md },
  locked: { opacity: 0.55 },
  name: { ...typography.bodyStrong, color: colors.text },
  unlock: { ...typography.caption, color: colors.textSub, textAlign: 'center' },
});
