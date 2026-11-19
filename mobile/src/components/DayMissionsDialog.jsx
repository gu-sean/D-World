/**
 * 하루 동안 완료한 미션을 보여 주는 창.
 *
 * 리포트 '주간' 막대그래프에서 막대를 누르면 뜬다. 목록은 미션 목록 API(A30)를
 * 그 날짜·완료 상태로 조회해 그대로 보여 준다. 미션을 누르면 `onMissionPress`로 넘긴다.
 *
 * @param {{
 *   date: string|null,
 *   onClose: () => void,
 *   onMissionPress?: (mission: object) => void
 * }} props `date`가 있으면 창이 열린다 (`YYYY-MM-DD`)
 */
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import Button from './Button';
import CategoryChip from './CategoryChip';
import Icon from './Icon';
import { format, useMissions } from '../client';
import { colors, radius, spacing, typography } from '../theme';

/** 창이 열렸을 때만 조회하도록 목록 부분을 따로 둔다 */
function CompletedMissionList({ date, onMissionPress }) {
  const missions = useMissions({ date, status: 'completed' });

  if (missions.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (missions.isError) {
    return <Text style={styles.message}>목록을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</Text>;
  }
  if (missions.items.length === 0) {
    return <Text style={styles.message}>이 날 완료한 미션이 없어요.</Text>;
  }

  return (
    <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
      {missions.items.map((mission) => {
        const target =
          mission.targetValue !== null && mission.targetValue !== undefined
            ? format.formatTarget(mission.targetValue, mission.targetUnit)
            : null;
        return (
          <TouchableOpacity
            key={mission.id}
            style={styles.row}
            disabled={!onMissionPress}
            onPress={() => onMissionPress?.(mission)}
            accessibilityRole="button"
            accessibilityLabel={`${mission.title} 상세 보기`}>
            <Icon name="check" size={18} color={colors.success} />
            <View style={styles.rowTexts}>
              <Text style={styles.rowTitle} numberOfLines={2}>
                {mission.title}
              </Text>
              <View style={styles.rowMeta}>
                <CategoryChip
                  categoryCode={mission.categoryCode}
                  name={mission.categoryName}
                  size="sm"
                />
                {!!target && <Text style={styles.rowMetaText}>{target}</Text>}
              </View>
            </View>
            {!!onMissionPress && <Icon name="chevronRight" size={16} color={colors.border} />}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export default function DayMissionsDialog({ date, onClose, onMissionPress }) {
  return (
    <Modal visible={!!date} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{date ? format.formatDate(date) : ''} 완료한 미션</Text>
          {!!date && <CompletedMissionList date={date} onMissionPress={onMissionPress} />}
          <Button title="닫기" variant="secondary" onPress={onClose} full />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxHeight: '75%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { ...typography.subtitle, color: colors.text },
  center: { paddingVertical: spacing.lg, alignItems: 'center' },
  message: { ...typography.body, color: colors.textSub, paddingVertical: spacing.sm },
  list: { flexGrow: 0 },
  listContent: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.neutralSoft,
  },
  rowTexts: { flex: 1, gap: spacing.xs },
  rowTitle: { ...typography.bodyStrong, color: colors.text },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowMetaText: { ...typography.caption, color: colors.textSub },
});
