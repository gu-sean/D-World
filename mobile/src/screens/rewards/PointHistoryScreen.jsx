// POINT-01 포인트
//
// 지금 쓸 수 있는 포인트와 이번 달 획득량을 위에 보여 주고, 아래에 거래 내역을 쌓는다.
// 들어온 것만·나간 것만 걸러 볼 수 있다.
//
// 금액은 서버가 준 값 그대로 쓴다 — 앱에서 더하거나 빼지 않는다.
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { format, labels, usePointTransactions, usePoints } from '../../client';
import {
  Button,
  Card,
  OptionRow,
  ProgressBar,
  QueryState,
  Screen,
} from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const FILTERS = [
  { value: null, label: '전체' },
  { value: 'earn', label: '받은 것' },
  { value: 'spend', label: '쓴 것' },
];

export default function PointHistoryScreen({ navigation }) {
  const [direction, setDirection] = useState(null);
  const balance = usePoints();
  const transactions = usePointTransactions(direction ? { direction } : {});

  const monthly = balance.data;

  return (
    <Screen
      title="포인트"
      onBack={() => navigation.goBack()}
      padded={false}
      right={
        <Button
          title="상점"
          size="sm"
          variant="text"
          onPress={() => navigation.navigate(Routes.SHOP)}
        />
      }>
      <View style={styles.head}>
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>쓸 수 있는 포인트</Text>
          <Text style={styles.balance}>
            {monthly ? format.formatPoints(monthly.availablePoints) : '-'}
          </Text>
          {!!monthly && (
            <View style={styles.monthly}>
              <ProgressBar
                rate={monthly.monthlyEarnedPoints / Math.max(1, monthly.monthlyLimitPoints)}
                label={`이번 달 획득 ${format.formatNumber(monthly.monthlyEarnedPoints)} / ${format.formatNumber(monthly.monthlyLimitPoints)}`}
              />
            </View>
          )}
        </Card>

        <OptionRow options={FILTERS} value={direction} onChange={setDirection} />
      </View>

      <QueryState
        query={transactions}
        data={transactions.items}
        isEmpty={transactions.items.length === 0}
        emptyTitle="아직 내역이 없어요">
        {(items) => (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            onEndReached={() => transactions.hasNextPage && transactions.fetchNextPage()}
            onEndReachedThreshold={0.4}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={styles.rowTexts}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {labels.pointTransactionKind[item.kind] ?? item.kind} ·{' '}
                    {format.formatRelative(item.occurredAt)}
                  </Text>
                </View>
                <View style={styles.rowAmount}>
                  <Text
                    style={[
                      styles.amount,
                      item.direction === 'earn' ? styles.earn : styles.spend,
                    ]}>
                    {item.amount > 0 ? '+' : ''}
                    {format.formatNumber(item.amount)}
                  </Text>
                  <Text style={styles.after}>{format.formatNumber(item.balanceAfter)}P</Text>
                </View>
              </View>
            )}
          />
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  balanceCard: { gap: spacing.xs },
  balanceLabel: { ...typography.caption, color: colors.textSub },
  balance: { ...typography.figure, color: colors.text },
  monthly: { marginTop: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowTexts: { flex: 1, gap: 2 },
  rowTitle: { ...typography.body, color: colors.text },
  rowMeta: { ...typography.caption, color: colors.textSub },
  rowAmount: { alignItems: 'flex-end', gap: 2 },
  amount: { ...typography.bodyStrong },
  earn: { color: colors.success },
  spend: { color: colors.text },
  after: { ...typography.caption, color: colors.textSub },
});
