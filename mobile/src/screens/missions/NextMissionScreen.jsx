// MISSION-14 다음 미션 추천
//
// 미션을 하나 끝낸 뒤 "이어서 뭘 할까"를 보여 준다. 서버가 AI 분석과 관심 분야를
// 섞어 최대 10개를 골라 주고, 그중 하나를 누르면 오늘 날짜 미션으로 바로 추가된다.
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { format, useCreateMission, useNextMissions } from '../../client';
import {
  Button,
  Card,
  CategoryChip,
  ErrorBanner,
  OptionRow,
  QueryState,
  Screen,
} from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const TABS = [
  { value: 'all', label: '전체' },
  { value: 'ai', label: 'AI 추천' },
  { value: 'interest', label: '관심 분야' },
];

export default function NextMissionScreen({ navigation }) {
  const [tab, setTab] = useState('all');
  const suggestions = useNextMissions(tab);
  const createMission = useCreateMission();

  const add = (definition) =>
    createMission.mutate(
      { definitionId: definition.id, scheduledDate: format.todayKst() },
      {
        onSuccess: (mission) =>
          navigation.replace(Routes.MISSION_DETAIL, { missionId: mission.id }),
      },
    );

  return (
    <Screen title="다음 미션" onBack={() => navigation.goBack()} padded={false}>
      <View style={styles.tabs}>
        <OptionRow options={TABS} value={tab} onChange={setTab} />
      </View>

      <ErrorBanner error={createMission.error} />

      <QueryState query={suggestions} emptyTitle="추천할 미션이 없어요">
        {(items) => (
          <FlatList
            data={items}
            keyExtractor={(definition) => definition.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Card style={styles.card}>
                <CategoryChip categoryCode={item.categoryCode} name={item.categoryName} size="sm" />
                <Text style={styles.title}>{item.title}</Text>
                {!!item.description && <Text style={styles.description}>{item.description}</Text>}
                <Text style={styles.meta}>{format.formatMissionMeta(item)}</Text>
                <View style={styles.addButton}>
                  <Button
                    title="오늘 할 미션으로 추가"
                    size="sm"
                    onPress={() => add(item)}
                    loading={createMission.isPending}
                  />
                </View>
              </Card>
            )}
          />
        )}
      </QueryState>

      <View style={styles.footer}>
        <Button title="홈으로" variant="text" onPress={() => navigation.navigate(Routes.HOME_TAB)} full />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  card: { gap: spacing.xs },
  title: { ...typography.bodyStrong, color: colors.text },
  description: { ...typography.caption, color: colors.textSub },
  meta: { ...typography.caption, color: colors.textSub },
  addButton: { alignSelf: 'flex-start', marginTop: spacing.xs },
  footer: { padding: spacing.lg },
});
