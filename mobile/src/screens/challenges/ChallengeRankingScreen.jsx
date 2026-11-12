// CHALLENGE-04 챌린지 순위
//
// 상위 50명과 내 순위를 보여 준다. 정산이 끝나기 전에는 순위가 바뀔 수 있으므로
// 확정 여부(`isFinal`)와 계산 시각을 함께 적는다.
//
// 내 줄은 목록 안에서 눈에 띄게 하고, 50위 밖이면 아래에 따로 띄워 둔다.
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { format, useChallengeRanking } from '../../client';
import { Card, QueryState, Screen } from '../../components';
import { colors, spacing, typography } from '../../theme';

/** 순위 한 줄 — 등수 / 이름 / 성공 일수 / 점수 */
function RankRow({ entry, standalone = false }) {
  return (
    <View style={[styles.row, entry.isMe && styles.rowMe, standalone && styles.rowStandalone]}>
      <Text style={[styles.rank, entry.isMe && styles.textMe]}>{entry.rankNo}</Text>
      <View style={styles.nameBox}>
        <Text style={[styles.name, entry.isMe && styles.textMe]} numberOfLines={1}>
          {entry.displayName}
          {entry.isMe ? ' (나)' : ''}
        </Text>
        <Text style={styles.days}>성공 {entry.successfulDays}일</Text>
      </View>
      <Text style={[styles.score, entry.isMe && styles.textMe]}>{entry.score}점</Text>
    </View>
  );
}

export default function ChallengeRankingScreen({ navigation, route }) {
  const { challengeId } = route.params ?? {};
  const ranking = useChallengeRanking(challengeId);

  return (
    <Screen title="순위" onBack={() => navigation.goBack()} padded={false}>
      <QueryState query={ranking}>
        {(data) => {
          const entries = data.entries ?? [];
          const meInList = entries.some((entry) => entry.isMe);

          return (
            <>
              <View style={styles.head}>
                <Text style={styles.headText}>
                  {data.isFinal ? '확정된 순위예요.' : '아직 바뀔 수 있는 중간 순위예요.'}
                </Text>
                <Text style={styles.headMeta}>
                  {data.participantCount}명 참여 · {format.formatDateTime(data.calculatedAt)} 기준
                </Text>
              </View>

              <FlatList
                data={entries}
                keyExtractor={(entry) => `${entry.rankNo}-${entry.displayName}`}
                contentContainerStyle={styles.list}
                refreshing={ranking.isFetching}
                onRefresh={ranking.refetch}
                renderItem={({ item }) => <RankRow entry={item} />}
                ListEmptyComponent={
                  <Text style={styles.empty}>아직 집계된 순위가 없어요.</Text>
                }
              />

              {!!data.me && !meInList && (
                <Card style={styles.myCard}>
                  <Text style={styles.myLabel}>내 순위</Text>
                  <RankRow entry={data.me} standalone />
                </Card>
              )}
            </>
          );
        }}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { padding: spacing.lg, paddingBottom: spacing.sm, gap: 2 },
  headText: { ...typography.body, color: colors.text },
  headMeta: { ...typography.caption, color: colors.textSub },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowMe: { backgroundColor: '#EBF1FF', paddingHorizontal: spacing.sm, borderRadius: 8 },
  rowStandalone: { borderBottomWidth: 0, paddingVertical: 0 },
  rank: { ...typography.subtitle, color: colors.text, width: 36, textAlign: 'center' },
  nameBox: { flex: 1 },
  name: { ...typography.body, color: colors.text },
  days: { ...typography.caption, color: colors.textSub },
  score: { ...typography.bodyStrong, color: colors.text },
  textMe: { color: colors.primary },
  empty: { ...typography.body, color: colors.textSub, textAlign: 'center', padding: spacing.xl },
  myCard: { margin: spacing.lg, marginTop: 0, gap: spacing.xs },
  myLabel: { ...typography.caption, color: colors.textSub },
});
