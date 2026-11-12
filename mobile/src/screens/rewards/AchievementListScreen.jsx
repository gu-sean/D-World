// ACHIEVE-01 업적
//
// 얻을 수 있는 업적을 모두 보여 주고, 각각 얼마나 왔는지 막대로 표시한다.
// 희귀도로 걸러 볼 수 있다.
//
// 이미 얻은 업적은 눌러서 대표 배지로 지정할 수 있다. 지금 대표인 것을 다시 누르면
// 해제된다 — 대표 배지는 프로필에 하나만 걸 수 있다.
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { format, labels, useAchievements, useSetRepresentativeBadge } from '../../client';
import {
  Card,
  ErrorBanner,
  Icon,
  OptionRow,
  ProgressBar,
  QueryState,
  Screen,
  StatusTag,
} from '../../components';
import { colors, spacing, typography } from '../../theme';

const RARITIES = [
  { value: null, label: '전체' },
  { value: 'common', label: labels.achievementRarity.common },
  { value: 'rare', label: labels.achievementRarity.rare },
  { value: 'legendary', label: labels.achievementRarity.legendary },
];

const RARITY_TONE = { common: 'neutral', rare: 'primary', legendary: 'warning' };

export default function AchievementListScreen({ navigation }) {
  const [rarity, setRarity] = useState(null);
  const achievements = useAchievements(rarity ? { rarity } : {});
  const setBadge = useSetRepresentativeBadge();

  const toggleBadge = (item) => {
    if (item.status !== 'earned') return;
    setBadge.mutate({ achievementId: item.isRepresentative ? null : item.id });
  };

  return (
    <Screen title="업적" onBack={() => navigation.goBack()} padded={false}>
      <View style={styles.filter}>
        <OptionRow options={RARITIES} value={rarity} onChange={setRarity} />
      </View>

      <ErrorBanner error={setBadge.error} />

      <QueryState query={achievements} emptyTitle="업적이 없어요">
        {(items) => (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const earned = item.status === 'earned';
              return (
                <Card
                  onPress={earned ? () => toggleBadge(item) : undefined}
                  style={[styles.card, !earned && styles.dim]}>
                  <View style={styles.topRow}>
                    <View style={styles.titleRow}>
                      <Icon
                        name="trophy"
                        size={18}
                        color={earned ? colors.warning : colors.border}
                      />
                      <Text style={styles.title}>{item.title}</Text>
                    </View>
                    <StatusTag
                      text={labels.achievementRarity[item.rarity]}
                      tone={RARITY_TONE[item.rarity]}
                    />
                  </View>

                  {!!item.description && (
                    <Text style={styles.description}>{item.description}</Text>
                  )}

                  {earned ? (
                    <View style={styles.earnedRow}>
                      <Text style={styles.earnedAt}>
                        {item.earnedAt ? `${format.formatDate(item.earnedAt)} 획득` : '획득'}
                      </Text>
                      {item.isRepresentative ? (
                        <StatusTag text="대표 배지" tone="primary" />
                      ) : (
                        <Text style={styles.setBadge}>눌러서 대표 배지로</Text>
                      )}
                    </View>
                  ) : (
                    <ProgressBar
                      rate={item.progressCount / Math.max(1, item.targetCount)}
                      label={`${item.progressCount} / ${item.targetCount}`}
                    />
                  )}

                  <Text style={styles.reward}>
                    보상 {format.formatPoints(item.rewardPoints)} · {item.rewardUserXp} XP
                  </Text>
                </Card>
              );
            }}
          />
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filter: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  card: { gap: spacing.sm },
  dim: { opacity: 0.7 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 },
  title: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  description: { ...typography.caption, color: colors.textSub },
  earnedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  earnedAt: { ...typography.caption, color: colors.textSub },
  setBadge: { ...typography.caption, color: colors.primary },
  reward: { ...typography.caption, color: colors.textSub },
});
