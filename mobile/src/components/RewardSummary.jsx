/**
 * 인증에 성공해서 실제로 받은 보상을 보여 준다.
 *
 * 서버가 준 값만 그린다 — 앱이 포인트를 계산하거나 레벨을 짐작하지 않는다.
 * 월 한도 때문에 포인트가 깎였으면(`pointsCapped`) 그 사실을 함께 알려 주고,
 * 레벨업·펫 진화·새 업적처럼 이번에 일어난 일만 줄을 추가한다.
 *
 * @param {{rewards?: object|null}} props `GrantedRewards`
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Card from './Card';
import Icon from './Icon';
import { format } from '../client';
import { colors, spacing, typography } from '../theme';

export default function RewardSummary({ rewards }) {
  if (!rewards) return null;

  const extras = [];
  if (rewards.levelUp && rewards.newLevelNo) extras.push(`레벨 ${rewards.newLevelNo} 달성`);
  if (rewards.petEvolved) extras.push('펫이 진화했어요');
  if (rewards.streakDays > 0) extras.push(`${rewards.streakDays}일 연속 달성 중`);

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Reward icon="coin" label="포인트" value={format.formatPoints(rewards.points)} />
        <Reward icon="star" label="경험치" value={`${format.formatNumber(rewards.userXp)} XP`} />
        <Reward icon="paw" label="펫 경험치" value={`${format.formatNumber(rewards.petXp)} XP`} />
      </View>

      {rewards.pointsCapped && (
        <Text style={styles.note}>이번 달 포인트 한도에 걸려 일부만 지급됐어요.</Text>
      )}

      {extras.map((text) => (
        <View key={text} style={styles.extraRow}>
          <Icon name="check" size={14} color={colors.success} strokeWidth={2.4} />
          <Text style={styles.extra}>{text}</Text>
        </View>
      ))}

      {(rewards.newBadges ?? []).map((badge) => (
        <View key={badge.achievementId} style={styles.extraRow}>
          <Icon name="trophy" size={14} color={colors.warning} />
          <Text style={styles.extra}>새 업적 · {badge.title}</Text>
        </View>
      ))}
    </Card>
  );
}

function Reward({ icon, label, value }) {
  return (
    <View style={styles.reward}>
      <Icon name={icon} size={20} color={colors.primary} />
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  reward: { alignItems: 'center', gap: 2 },
  value: { ...typography.bodyStrong, color: colors.text },
  label: { ...typography.caption, color: colors.textSub },
  note: { ...typography.caption, color: colors.warning },
  extraRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  extra: { ...typography.caption, color: colors.textSub },
});
