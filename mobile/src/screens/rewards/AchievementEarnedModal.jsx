// ACHIEVE-02 업적 획득 축하
//
// 인증에 성공하면서 새 업적을 얻었을 때 위에 떠서 알려 준다.
// 보여 줄 내용은 보상 응답에 담겨 온 배지 목록이라 따로 조회하지 않는다.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { labels } from '../../client';
import { Button, Icon } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';

export default function AchievementEarnedModal({ navigation, route }) {
  const badges = route.params?.badges ?? [];

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Icon name="trophy" size={40} color={colors.warning} />
        <Text style={styles.heading}>
          {badges.length > 1 ? `업적 ${badges.length}개를 얻었어요!` : '새 업적을 얻었어요!'}
        </Text>

        <View style={styles.badges}>
          {badges.map((badge) => (
            <View key={badge.achievementId} style={styles.badgeRow}>
              <Icon name="star" size={16} color={colors.warning} />
              <Text style={styles.badgeTitle}>{badge.title}</Text>
              <Text style={styles.badgeRarity}>
                {labels.achievementRarity[badge.rarity] ?? badge.rarity}
              </Text>
            </View>
          ))}
        </View>

        <Button title="확인" onPress={() => navigation.goBack()} full />
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
    gap: spacing.md,
  },
  heading: { ...typography.subtitle, color: colors.text, textAlign: 'center' },
  badges: { alignSelf: 'stretch', gap: spacing.sm },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badgeTitle: { ...typography.body, color: colors.text, flex: 1 },
  badgeRarity: { ...typography.caption, color: colors.textSub },
});
