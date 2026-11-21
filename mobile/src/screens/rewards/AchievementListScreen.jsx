// ACHIEVE-01 업적
//
// 얻을 수 있는 업적을 모두 보여 주고, 각각 얼마나 왔는지 막대로 표시한다.
// 희귀도로 걸러 볼 수 있다.
//
// 업적의 이름·설명·희귀도·달성 조건·목표·보상·배지 이미지는 모두 관리자 웹
// '보상 → 업적 정책'에서 정한 값을 서버(A76)가 그대로 내려 준다. 화면은 그 값을 보여만 준다.
//
// 이미 얻은 업적은 눌러서 대표 배지로 지정할 수 있다. 지금 대표인 것을 다시 누르면
// 해제된다 — 대표 배지는 프로필에 하나만 걸 수 있다. 지금 대표가 무엇인지는 내 정보(A11)의
// representativeBadge로 안다 (A76에는 대표 여부가 없다).
import React, { useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';

import { format, labels, useAchievements, useMe, useSetRepresentativeBadge } from '../../client';
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
import { colors, radius, spacing, typography } from '../../theme';

const RARITIES = [
  { value: null, label: '전체' },
  { value: 'common', label: labels.achievementRarity.common },
  { value: 'rare', label: labels.achievementRarity.rare },
  { value: 'legendary', label: labels.achievementRarity.legendary },
];

const RARITY_TONE = { common: 'neutral', rare: 'primary', legendary: 'warning' };

const BADGE_SIZE = 44;

/** 서버는 `earned`(불리언)로 준다. 예전 응답 모양(`status: 'earned'`)도 함께 받아 준다. */
const isEarned = (item) => item.earned === true || item.status === 'earned';

/** 관리자가 정한 달성 조건을 사용자 문장으로 바꾼다 (조건 종류 + 목표 횟수 + 분야) */
function conditionText(item) {
  const target = format.formatNumber(item.targetCount);
  switch (item.conditionType) {
    case 'first_goal_completed':
      return '목표를 처음으로 완료하기';
    case 'approved_mission_count':
      return `미션 ${target}개 인증 성공하기`;
    case 'category_approved_mission_count':
      return `${item.categoryName ?? '해당 분야'} 미션 ${target}개 인증 성공하기`;
    case 'streak_milestone':
      return `${target}일 연속 달성하기`;
    case 'challenge_completed':
      return `챌린지 ${target}개 완주하기`;
    default:
      return labels.achievementCondition[item.conditionType] ?? '';
  }
}

/**
 * 업적 자체 보상이 없는 조건: 연속 달성·챌린지 완주는 각자의 보상(연속 달성 보상·챌린지 보상)으로
 * 따로 받는다 (서버 achievements.service SHARED_REWARD_CONDITIONS와 같은 구분)
 */
const SHARED_REWARD_TEXT = {
  streak_milestone: '보상은 연속 달성 보상으로 받아요',
  challenge_completed: '보상은 챌린지 보상으로 받아요',
};

/** 관리자가 정한 보상 (포인트·펫 경험치) */
function rewardText(item) {
  const points = Number(item.rewardPoints) || 0;
  const petXp = Number(item.rewardPetXp) || 0;
  if (points === 0 && petXp === 0) {
    return SHARED_REWARD_TEXT[item.conditionType] ?? '보상 없음';
  }
  const parts = [];
  if (points > 0) parts.push(format.formatPoints(points));
  if (petXp > 0) parts.push(`펫 경험치 ${format.formatNumber(petXp)}`);
  return `보상 ${parts.join(' · ')}`;
}

function Badge({ item, earned }) {
  if (item.badgeImageUrl) {
    return (
      <Image
        source={{ uri: item.badgeImageUrl }}
        style={[styles.badgeImage, !earned && styles.badgeLocked]}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={styles.badgeFallback}>
      <Icon name="trophy" size={22} color={earned ? colors.warning : colors.border} />
    </View>
  );
}

export default function AchievementListScreen({ navigation }) {
  const [rarity, setRarity] = useState(null);
  const achievements = useAchievements(rarity ? { rarity } : {});
  const me = useMe();
  const setBadge = useSetRepresentativeBadge();

  const representativeId = me.data?.representativeBadge?.achievementId ?? null;

  const toggleBadge = (item) => {
    if (!isEarned(item)) return;
    setBadge.mutate({ achievementId: item.id === representativeId ? null : item.id });
  };

  return (
    <Screen title="업적" onBack={() => navigation.goBack()} padded={false}>
      <View style={styles.filter}>
        <OptionRow options={RARITIES} value={rarity} onChange={setRarity} />
      </View>

      <ErrorBanner error={setBadge.error} />
      <Text style={styles.limitNote}>업적 보상은 하루 포인트 한도와 상관없이 전부 받아요.</Text>

      <QueryState query={achievements} emptyTitle="업적이 없어요">
        {(items) => (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const earned = isEarned(item);
              const isRepresentative = earned && item.id === representativeId;
              return (
                <Card
                  onPress={earned ? () => toggleBadge(item) : undefined}
                  style={[styles.card, !earned && styles.dim]}>
                  <View style={styles.topRow}>
                    <Badge item={item} earned={earned} />
                    <View style={styles.titleBox}>
                      <Text style={styles.title}>{item.title}</Text>
                      <Text style={styles.condition}>{conditionText(item)}</Text>
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
                      {isRepresentative ? (
                        <StatusTag text="대표 배지" tone="primary" />
                      ) : (
                        <Text style={styles.setBadge}>눌러서 대표 배지로</Text>
                      )}
                    </View>
                  ) : (
                    <ProgressBar
                      rate={item.progressCount / Math.max(1, item.targetCount)}
                      label={`${format.formatNumber(item.progressCount)} / ${format.formatNumber(
                        item.targetCount,
                      )}`}
                    />
                  )}

                  <Text style={styles.reward}>{rewardText(item)}</Text>
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
  limitNote: {
    ...typography.caption,
    color: colors.textSub,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  card: { gap: spacing.sm },
  dim: { opacity: 0.7 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badgeImage: { width: BADGE_SIZE, height: BADGE_SIZE, borderRadius: radius.md },
  badgeLocked: { opacity: 0.4 },
  badgeFallback: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: radius.md,
    backgroundColor: colors.neutralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBox: { flex: 1, gap: 2 },
  title: { ...typography.bodyStrong, color: colors.text },
  condition: { ...typography.caption, color: colors.primary },
  description: { ...typography.caption, color: colors.textSub },
  earnedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  earnedAt: { ...typography.caption, color: colors.textSub },
  setBadge: { ...typography.caption, color: colors.primary },
  reward: { ...typography.caption, color: colors.textSub },
});
