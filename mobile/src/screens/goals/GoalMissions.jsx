// 목표에 묶인 세부 미션 목록 (목표 보드의 ∨ 펼침과 목표 상세가 같이 쓴다)
//
// 미션을 누르면 미션 상세로 간다. `onEdit`·`onCancel`을 넘기면 아직 시작하지 않은
// 미션(예정, 챌린지 미션 아님) 옆에 수정·취소 버튼이 붙는다.
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { format, labels, useMissions } from '../../client';
import { StatusTag } from '../../components';
import { STATUS_TONE } from '../../components/StatusTag';
import { colors, spacing, typography } from '../../theme';

const canEdit = (mission) => mission.status === 'scheduled' && !mission.challengeId;

export default function GoalMissions({ goalId, onOpenMission, onEdit, onCancel }) {
  const missions = useMissions({ goalId });
  const editable = Boolean(onEdit || onCancel);

  if (missions.isLoading) {
    return <ActivityIndicator style={styles.loading} color={colors.primary} />;
  }
  if (missions.isError) {
    return <Text style={styles.empty}>세부 미션을 불러오지 못했어요.</Text>;
  }
  if (missions.items.length === 0) {
    return <Text style={styles.empty}>아직 세부 미션이 없어요.</Text>;
  }

  return (
    <View style={styles.list}>
      {missions.items.map((mission) => (
        <View key={mission.id} style={styles.item}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => onOpenMission(mission.id)}
            accessibilityRole="button">
            <View style={styles.texts}>
              <Text style={styles.title} numberOfLines={2}>
                {mission.title}
              </Text>
              {!!mission.scheduledDate && (
                <Text style={styles.meta}>{format.formatDate(mission.scheduledDate)}</Text>
              )}
            </View>
            <StatusTag
              text={labels.missionStatus[mission.status] ?? mission.status}
              tone={STATUS_TONE[mission.status]}
            />
          </TouchableOpacity>
          {editable && canEdit(mission) && (
            <View style={styles.actions}>
              {!!onEdit && (
                <TouchableOpacity
                  onPress={() => onEdit(mission.id)}
                  style={styles.action}
                  accessibilityRole="button">
                  <Text style={styles.actionText}>수정</Text>
                </TouchableOpacity>
              )}
              {!!onCancel && (
                <TouchableOpacity
                  onPress={() => onCancel(mission)}
                  style={styles.action}
                  accessibilityRole="button">
                  <Text style={[styles.actionText, styles.danger]}>취소</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs },
  item: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  texts: { flex: 1, gap: 2 },
  title: { ...typography.body, color: colors.text },
  meta: { ...typography.caption, color: colors.textSub },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md },
  action: { paddingVertical: 2, paddingHorizontal: spacing.xs },
  actionText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  danger: { color: colors.danger },
  loading: { paddingVertical: spacing.sm },
  empty: { ...typography.caption, color: colors.textSub, paddingVertical: spacing.xs },
});
