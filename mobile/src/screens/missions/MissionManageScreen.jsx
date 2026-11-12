// MISSION-12 미션 관리 (미션 탭 첫 화면)
//
// 고른 날짜의 미션을 모아 보여 주고, 거기서 추가·수정으로 이어진다.
// 날짜는 위쪽 화살표로 하루씩 옮긴다.
//
// 미션을 만드는 길이 둘이다 — 미션 틀에서 고르기, 직접 적기.
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { format, useMissions } from '../../client';
import { Button, Icon, MissionCard, QueryState, Screen } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const DAY_MS = 86400000;

export default function MissionManageScreen({ navigation }) {
  const [date, setDate] = useState(() => format.todayKst());
  const missions = useMissions({ date });

  const move = (days) => {
    const base = Date.parse(`${date}T00:00:00+09:00`);
    setDate(format.toDateString(base + days * DAY_MS));
  };

  return (
    <Screen title="미션 관리" padded={false}>
      <View style={styles.dateBar}>
        <TouchableOpacity onPress={() => move(-1)} accessibilityRole="button" hitSlop={8}>
          <Icon name="chevronLeft" size={22} color={colors.textSub} />
        </TouchableOpacity>

        <View style={styles.dateTexts}>
          <Text style={styles.date}>{format.formatDate(date)}</Text>
          {date !== format.todayKst() && (
            <TouchableOpacity onPress={() => setDate(format.todayKst())} hitSlop={8}>
              <Text style={styles.today}>오늘로</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={() => move(1)} accessibilityRole="button" hitSlop={8}>
          <Icon name="chevronRight" size={22} color={colors.textSub} />
        </TouchableOpacity>
      </View>

      <QueryState
        query={missions}
        data={missions.items}
        isEmpty={missions.items.length === 0}
        emptyTitle="이 날짜에 미션이 없어요"
        emptyText="미션 틀에서 고르거나 직접 만들어 보세요.">
        {(items) => (
          <FlatList
            data={items}
            keyExtractor={(mission) => mission.id}
            contentContainerStyle={styles.list}
            onEndReached={() => missions.hasNextPage && missions.fetchNextPage()}
            onEndReachedThreshold={0.4}
            refreshing={missions.isFetching}
            onRefresh={missions.refetch}
            renderItem={({ item }) => (
              <MissionCard
                mission={item}
                onPress={() => navigation.navigate(Routes.MISSION_DETAIL, { missionId: item.id })}
              />
            )}
          />
        )}
      </QueryState>

      <View style={styles.footer}>
        <View style={styles.footerSlot}>
          <Button
            title="미션 틀에서 고르기"
            variant="secondary"
            onPress={() => navigation.navigate(Routes.MISSION_CATALOG, { date })}
            full
          />
        </View>
        <View style={styles.footerSlot}>
          <Button
            title="직접 만들기"
            icon="plus"
            onPress={() => navigation.navigate(Routes.MISSION_FORM, { date })}
            full
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  dateTexts: { alignItems: 'center', gap: 2 },
  date: { ...typography.bodyStrong, color: colors.text },
  today: { ...typography.caption, color: colors.primary },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerSlot: { flex: 1 },
});
