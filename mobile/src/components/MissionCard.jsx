/**
 * 미션 한 건을 줄여 보여 주는 카드. 홈과 미션 목록에서 같은 모양으로 쓴다.
 *
 * 보여 주는 것: 분야 칩, 제목, 목표 값(단위까지), 예상 소요 시간, 상태, 예상 보상.
 * 상태 글자는 `labels.missionStatus`에서, 숫자·단위는 `format`에서 가져온다.
 * 챌린지 미션은 보상이 0이므로 보상 줄을 숨긴다.
 *
 * @param {{mission: object, onPress?: () => void, showDate?: boolean}} props
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Card from './Card';
import CategoryChip from './CategoryChip';
import Icon from './Icon';
import StatusTag, { STATUS_TONE } from './StatusTag';
import { format, labels } from '../client';
import { colors, spacing, typography } from '../theme';

export default function MissionCard({ mission, onPress, showDate = false }) {
  if (!mission) return null;

  const target =
    mission.targetValue !== null && mission.targetValue !== undefined
      ? format.formatTarget(mission.targetValue, mission.targetUnit)
      : null;
  const duration = mission.estimatedDurationSeconds
    ? format.formatSpokenDuration(mission.estimatedDurationSeconds)
    : null;
  const reward = mission.rewardPreview?.points ?? 0;

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.topRow}>
        <CategoryChip categoryCode={mission.categoryCode} name={mission.categoryName} size="sm" />
        <StatusTag
          text={labels.missionStatus[mission.status]}
          tone={STATUS_TONE[mission.status]}
        />
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {mission.title}
      </Text>

      <View style={styles.metaRow}>
        {!!target && <Text style={styles.meta}>{target}</Text>}
        {!!duration && (
          <>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.meta}>{duration}</Text>
          </>
        )}
        {showDate && (
          <>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.meta}>{format.formatDate(mission.scheduledDate)}</Text>
          </>
        )}
      </View>

      {reward > 0 && (
        <View style={styles.rewardRow}>
          <Icon name="coin" size={14} color={colors.warning} />
          <Text style={styles.reward}>{format.formatPoints(reward)}</Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.bodyStrong, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  meta: { ...typography.caption, color: colors.textSub },
  dot: { ...typography.caption, color: colors.border },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reward: { ...typography.caption, color: colors.textSub },
});
