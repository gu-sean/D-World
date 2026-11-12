// SITUATION-04·05·06 상황 추천 목록
//
// `kind`에 따라 들어오는 길이 셋이다 — 위치 기반(location), 이동 중(moving),
// 날씨 기반(weather). 세 경우 모두 같은 요청을 쓰고 화면 문구만 달라진다.
//
// 화면에 들어오면 한 번 추천을 받아 온다. 위치 권한이 없거나 못 잡아도 요청은
// 그대로 나가고, 서버가 날씨 없이 추천해 준다. 추천이 쓸 만하지 않으면
// "다시 받기"로 새로 요청할 수 있다.
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { labels, useSituationalRecommendations } from '../../client';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Icon,
  Screen,
  SectionTitle,
} from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const KINDS = {
  location: {
    title: '여기서 할 만한 미션',
    subtitle: '지금 있는 곳과 날씨를 보고 골랐어요',
    useLocation: true,
    isMoving: undefined,
  },
  moving: {
    title: '움직이는 중에 할 미션',
    subtitle: '이동 중에도 할 수 있는 가벼운 미션이에요',
    useLocation: false,
    isMoving: true,
  },
  weather: {
    title: '오늘 날씨에 맞는 미션',
    subtitle: '날씨와 시간대를 보고 골랐어요',
    useLocation: true,
    isMoving: undefined,
  },
};

/** 추천이 어떤 상황을 보고 나왔는지 한 줄로 적는다. */
function contextLine(context) {
  if (!context) return '';
  const parts = [labels.timeSlot[context.timeSlot], labels.weatherCode[context.weather]];
  if (typeof context.temperatureC === 'number') parts.push(`${context.temperatureC}°C`);
  if (context.isMoving) parts.push('이동 중');
  return parts.filter(Boolean).join(' · ');
}

export default function SituationRecommendScreen({ navigation, route }) {
  const { kind = 'weather' } = route.params ?? {};
  const preset = KINDS[kind] ?? KINDS.weather;
  const useLocation = route.params?.useLocation ?? preset.useLocation;

  const recommend = useSituationalRecommendations();

  const load = () => recommend.mutate({ kind, useLocation, isMoving: preset.isMoving });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, useLocation]);

  const list = recommend.data ?? [];
  const context = list[0]?.context;

  return (
    <Screen
      title={preset.title}
      subtitle={preset.subtitle}
      onBack={() => navigation.goBack()}
      padded={false}>
      <ErrorBanner error={recommend.error} />

      <ScrollView contentContainerStyle={styles.body}>
        {!!context && (
          <View style={styles.contextRow}>
            <Icon name={context.outdoorSuitable ? 'pin' : 'home'} size={16} color={colors.textSub} />
            <Text style={styles.contextText}>{contextLine(context)}</Text>
          </View>
        )}

        {recommend.isPending && list.length === 0 && (
          <Text style={styles.loading}>지금 상황에 맞는 미션을 찾고 있어요…</Text>
        )}

        {!recommend.isPending && list.length === 0 && (
          <EmptyState
            title="권할 만한 미션이 없어요"
            description="조금 뒤에 다시 받아 보거나, 미션 목록에서 직접 골라 보세요."
          />
        )}

        {list.length > 0 && <SectionTitle title={`추천 ${list.length}개`} />}

        {list.map((item) => (
          <Card
            key={item.id}
            onPress={() =>
              navigation.navigate(Routes.RECOMMENDATION_DETAIL, { recommendationId: item.id })
            }
            style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.rank}>{item.rankNo}순위</Text>
              <Icon name="chevronRight" size={16} color={colors.textSub} />
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.reason}>{item.reason}</Text>
          </Card>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="다시 받기"
          variant="secondary"
          onPress={load}
          loading={recommend.isPending}
          full
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  contextText: { ...typography.caption, color: colors.textSub },
  loading: { ...typography.body, color: colors.textSub, textAlign: 'center', padding: spacing.xl },
  card: { gap: spacing.xs },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rank: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  cardTitle: { ...typography.bodyStrong, color: colors.text },
  reason: { ...typography.caption, color: colors.textSub },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
