// PET-02 펫 도감
//
// 내가 키워 본 펫만 그림과 이름을 보여 준다. 아직 만나지 못한 펫은 "?"로 가려서
// 어떤 펫이 있는지 알 수 없게 한다 (서버도 이름·그림을 보내지 않는다).
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { labels, useMyPets, usePetSpecies } from '../../client';
import { Card, PetAvatar, QueryState, Screen, StatusTag } from '../../components';
import Routes from '../../navigation/routes';
import { colors, radius, spacing, typography } from '../../theme';

export default function PetCollectionScreen({ navigation }) {
  const species = usePetSpecies();
  const myPets = useMyPets();
  const petsBySpecies = new Map((myPets.data ?? []).map((pet) => [pet.speciesId, pet]));

  return (
    <Screen title="펫 도감" onBack={() => navigation.goBack()} padded={false}>
      <QueryState skeleton="grid" query={species} emptyTitle="보여 줄 펫이 없어요">
        {(items) => {
          const ownedCount = items.filter((item) => item.isOwned).length;
          const data = items.length % 3 ? [...items, ...Array.from({ length: 3 - (items.length % 3) }, (_, i) => ({ id: `__spacer${i}`, spacer: true }))] : items;
          return (
            <FlatList
              data={data}
              keyExtractor={(item) => item.id}
              numColumns={3}
              columnWrapperStyle={styles.row}
              contentContainerStyle={styles.list}
              ListHeaderComponent={
                <Text style={styles.count}>
                  만난 펫 {ownedCount} / {items.length}
                </Text>
              }
              renderItem={({ item }) => {
                if (item.spacer) return <View style={styles.spacer} />;
                if (!item.isOwned) {
                  return (
                    <Card style={[styles.card, styles.hiddenCard]} accessibilityLabel="아직 만나지 못한 펫">
                      <View style={styles.question}>
                        <Text style={styles.questionMark}>?</Text>
                      </View>
                      <Text style={styles.hiddenName}>???</Text>
                    </Card>
                  );
                }
                const pet = petsBySpecies.get(item.id);
                return (
                  <Card
                    onPress={() => navigation.navigate(Routes.PET_DETAIL, { speciesId: item.id })}
                    style={styles.card}>
                    <PetAvatar
                      pet={
                        pet ?? {
                          imageUrl: item.stages?.[0]?.imageUrl ?? null,
                          stillUrl: item.stages?.[0]?.stillUrl ?? null,
                          stageCode: 'egg',
                        }
                      }
                      size={64}
                    />
                    <Text style={styles.name} numberOfLines={1}>
                      {pet?.stageNo === 1 ? '???' : item.name}
                    </Text>
                    {!!pet && (
                      <StatusTag
                        text={labels.petStageCode[pet.stageCode] ?? ''}
                        tone={pet.isRepresentative ? 'primary' : 'success'}
                      />
                    )}
                  </Card>
                );
              }}
            />
          );
        }}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  row: { gap: spacing.sm },
  count: { ...typography.caption, color: colors.textSub, marginBottom: spacing.sm },
  card: { flex: 1, alignItems: 'center', gap: spacing.xs, padding: spacing.md },
  hiddenCard: { backgroundColor: colors.neutralSoft },
  spacer: { flex: 1 },
  name: { ...typography.bodyStrong, color: colors.text },
  question: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.trackSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionMark: { fontSize: 32, fontWeight: '700', color: colors.textSub },
  hiddenName: { ...typography.bodyStrong, color: colors.textSub },
});
