import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import {
  format,
  useAcceptRecommendations,
  useActiveRecommendations,
  useCreateMission,
  useNextMissions,
  useSituationalRecommendations,
} from '../../client';
import {
  Button,
  Card,
  CategoryChip,
  ErrorBanner,
  OptionRow,
  QueryState,
  Screen,
  StatusTag,
} from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const TABS = [
  { value: 'ai', label: 'LLM 추천' },
  { value: 'interest', label: '관심 분야' },
  { value: 'all', label: '전체' },
];

const toLlmItem = (recommendation) => ({
  ...(recommendation.missionDefinition ?? {}),
  id: recommendation.id,
  recommendationId: recommendation.id,
  title: recommendation.title ?? recommendation.missionDefinition?.title,
  reason: recommendation.reason,
  difficultyRecommended: true,
});

export default function NextMissionScreen({ navigation, route }) {
  const { goalId } = route.params ?? {};
  const [tab, setTab] = useState('ai');
  const [selectedIds, setSelectedIds] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const llmLoaded = useRef(false);
  const suggestions = useNextMissions(tab === 'ai' ? 'all' : tab);
  const activeRecommendations = useActiveRecommendations();
  const llmRecommendations = useSituationalRecommendations();
  const acceptRecommendations = useAcceptRecommendations();
  const createMission = useCreateMission();

  useEffect(() => {
    if (tab !== 'ai' || llmLoaded.current || activeRecommendations.isLoading) return;
    llmLoaded.current = true;
    if ((activeRecommendations.data ?? []).length > 0) return;
    llmRecommendations.mutate({ kind: 'weather', useLocation: false });
  }, [activeRecommendations.data, activeRecommendations.isLoading, llmRecommendations, tab]);

  const items = useMemo(
    () =>
      tab === 'ai'
        ? (llmRecommendations.data ?? activeRecommendations.data ?? []).map(toLlmItem)
        : (suggestions.data ?? []),
    [activeRecommendations.data, llmRecommendations.data, suggestions.data, tab],
  );
  const selected = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds],
  );

  const changeTab = (value) => {
    setTab(value);
    setSelectedIds([]);
  };
  const toggle = (id) =>
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

  const addSelected = async () => {
    if (selected.length === 0 || isAdding) return;
    setIsAdding(true);
    try {
      if (tab === 'ai') {
        await acceptRecommendations.mutateAsync({
          recommendationIds: selected.map((item) => item.recommendationId),
          goalId: goalId ?? undefined,
        });
      } else {
        for (const definition of selected) {
          await createMission.mutateAsync({
            definitionId: definition.id,
            goalId: goalId ?? undefined,
            scheduledDate: format.todayKst(),
          });
        }
      }
      Alert.alert('미션 추가 완료', `${selected.length}개의 추천 미션을 오늘 일정에 추가했어요.`, [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
      setSelectedIds([]);
    } finally {
      setIsAdding(false);
    }
  };

  const query =
    tab === 'ai'
      ? (activeRecommendations.data ?? []).length > 0 && !llmRecommendations.data
        ? activeRecommendations
        : {
            ...llmRecommendations,
            isLoading: activeRecommendations.isLoading || llmRecommendations.isPending,
            refetch: () => llmRecommendations.mutate({ kind: 'weather', useLocation: false }),
          }
      : suggestions;
  const error =
    acceptRecommendations.error ??
    createMission.error ??
    llmRecommendations.error ??
    activeRecommendations.error ??
    suggestions.error;

  return (
    <Screen
      title="LLM 미션 추천"
      subtitle="추천 이유를 확인하고 필요한 미션을 최대 3개 골라 추가하세요."
      onBack={() => navigation.goBack()}
      padded={false}>
      <View style={styles.tabs}>
        <OptionRow options={TABS} value={tab} onChange={changeTab} />
      </View>
      <ErrorBanner error={error} />
      <QueryState
        query={query}
        data={items}
        isEmpty={!query.isLoading && items.length === 0}
        emptyTitle="추천할 미션이 아직 없어요">
        {(definitions) => (
          <FlatList
            data={definitions}
            keyExtractor={(definition) => definition.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const checked = selectedIds.includes(item.id);
              const disabled = !checked && selectedIds.length >= 3;
              return (
                <Card
                  onPress={() => !disabled && toggle(item.id)}
                  style={[styles.card, checked && styles.selectedCard, disabled && styles.disabledCard]}>
                  <View style={styles.cardTop}>
                    <CategoryChip categoryCode={item.categoryCode} name={item.categoryName} size="sm" />
                    <StatusTag text={checked ? '선택됨' : '선택'} tone={checked ? 'primary' : 'neutral'} />
                  </View>
                  <Text style={styles.title}>{item.title}</Text>
                  {!!item.description && <Text style={styles.description}>{item.description}</Text>}
                  {!!item.reason && <Text style={styles.reason}>LLM 이유 · {item.reason}</Text>}
                  <Text style={styles.meta}>{format.formatMissionMeta(item)}</Text>
                  {item.difficultyRecommended && (
                    <Text style={styles.recommended}>프로필과 최근 수행 기록을 반영한 추천</Text>
                  )}
                </Card>
              );
            }}
          />
        )}
      </QueryState>
      <View style={styles.footer}>
        <Text style={styles.selectionText}>
          {selected.length > 0 ? `${selected.length}개 선택됨` : '추가할 미션을 선택해 주세요.'}
        </Text>
        <Button
          title={goalId ? '선택한 미션을 이 목표에 추가' : '선택한 미션 추가'}
          onPress={addSelected}
          loading={isAdding}
          disabled={selected.length === 0}
          full
        />
        <Button title="직접 목표 만들기" variant="text" onPress={() => navigation.navigate(Routes.GOAL_FORM)} full />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  card: { gap: spacing.xs },
  selectedCard: { borderColor: colors.primary, backgroundColor: '#F5F8FF' },
  disabledCard: { opacity: 0.5 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.bodyStrong, color: colors.text },
  description: { ...typography.caption, color: colors.textSub },
  reason: { ...typography.caption, color: colors.primary },
  meta: { ...typography.caption, color: colors.textSub },
  recommended: { ...typography.caption, color: colors.primary },
  footer: { padding: spacing.lg, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  selectionText: { ...typography.caption, color: colors.textSub, textAlign: 'center' },
});
