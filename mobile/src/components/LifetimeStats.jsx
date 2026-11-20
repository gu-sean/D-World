/**
 * 지금까지의 누적 기록을 2×2 숫자 타일로 보여 준다.
 *
 * 리포트 '전체' 탭에서 쓴다. 숫자는 모두 서버 값 그대로다.
 *   완료한 미션   ReportSummary(A60, period=all)의 `completedMissionCount` — 화면에서 넘겨받는다
 *   최장 연속     StreakStatus(A75)의 `bestSuccessDays`
 *   보유 포인트   PointBalance(A73)의 `availablePoints` (누적 획득량은 API에 없어 지금 쓸 수 있는 값)
 *   획득 배지     Achievement[](A76) 중 `earned === true` 개수 / 전체 개수
 * 타일을 누르면 `onNavigate(routeName)`으로 해당 화면 이름을 넘긴다 (완료한 미션 타일은 이동 없음).
 *
 * @param {{completedMissionCount: number, onNavigate?: (route: string) => void}} props
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Icon from './Icon';
import { format, useAchievements, usePoints, useStreak } from '../client';
import Routes from '../navigation/routes';
import { colors, radius, spacing, typography } from '../theme';

/** 아직 못 불러왔거나 실패한 값은 숫자 대신 이걸 보여 준다 */
const UNKNOWN = '–';

function Tile({ icon, iconColor, label, value, sub, onPress }) {
  return (
    <TouchableOpacity
      style={styles.tile}
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label} ${value}${sub ? `, ${sub}` : ''}`}>
      <View style={styles.tileHead}>
        <Icon name={icon} size={16} color={iconColor} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
      {!!sub && <Text style={styles.sub}>{sub}</Text>}
    </TouchableOpacity>
  );
}

export default function LifetimeStats({ completedMissionCount, onNavigate }) {
  const streak = useStreak();
  const points = usePoints();
  const achievements = useAchievements();

  const best = streak.data?.bestSuccessDays;
  const available = points.data?.availablePoints;
  const allBadges = achievements.data ?? [];
  // 서버는 획득 여부를 `earned`(불리언)로 준다 (예전 모양 `status: 'earned'`도 함께 받음)
  const earnedBadges = allBadges.filter(
    (item) => item.earned === true || item.status === 'earned',
  ).length;

  const go = (route) => (onNavigate ? () => onNavigate(route) : undefined);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>누적 기록</Text>
      <View style={styles.grid}>
        <Tile
          icon="check"
          iconColor={colors.success}
          label="완료한 미션"
          value={`${format.formatNumber(completedMissionCount ?? 0)}개`}
        />
        <Tile
          icon="flame"
          iconColor={colors.danger}
          label="최장 연속"
          value={best === undefined ? UNKNOWN : `${format.formatNumber(best)}일`}
          sub={
            streak.data?.currentSuccessDays !== undefined
              ? `지금 ${format.formatNumber(streak.data.currentSuccessDays)}일째`
              : undefined
          }
          onPress={go(Routes.STREAK)}
        />
        <Tile
          icon="coin"
          iconColor={colors.warning}
          label="보유 포인트"
          value={available === undefined ? UNKNOWN : `${format.formatNumber(available)}P`}
          onPress={go(Routes.POINT_HISTORY)}
        />
        <Tile
          icon="trophy"
          iconColor={colors.primary}
          label="획득 배지"
          value={achievements.isSuccess ? `${format.formatNumber(earnedBadges)}개` : UNKNOWN}
          sub={
            achievements.isSuccess && allBadges.length > 0
              ? `전체 ${format.formatNumber(allBadges.length)}개 중`
              : undefined
          }
          onPress={go(Routes.ACHIEVEMENT_LIST)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  title: { ...typography.bodyStrong, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    // 두 칸씩 놓이도록 간격(spacing.sm)의 절반을 뺀 너비
    flexBasis: '48%',
    flexGrow: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.neutralSoft,
    gap: 2,
  },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...typography.caption, color: colors.textSub },
  value: { ...typography.title, color: colors.text, marginTop: spacing.xs },
  sub: { ...typography.caption, color: colors.textSub },
});
