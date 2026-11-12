// POINT-02 상점
//
// 포인트로 바꿀 수 있는 물건을 보여 준다. 지금 잔액으로 살 수 없으면 버튼이 꺼지고,
// 영구 아이템을 이미 가지고 있으면 "보유 중"으로 바뀐다.
//
// 주문할 때는 화면에 보이던 가격 버전을 함께 보낸다. 그 사이 가격이 바뀌었으면
// 서버가 거절하므로 모르는 값으로 결제되는 일이 없다.
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { format, labels, useCreateShopOrder, useInventory, usePoints, useShopItems } from '../../client';
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorBanner,
  QueryState,
  Screen,
  StatusTag,
} from '../../components';
import { colors, spacing, typography } from '../../theme';

export default function ShopScreen({ navigation }) {
  const [picked, setPicked] = useState(null);

  const items = useShopItems();
  const balance = usePoints();
  const inventory = useInventory();
  const order = useCreateShopOrder();

  const available = balance.data?.availablePoints ?? 0;

  const buy = () =>
    order.mutate(
      { itemId: picked.id, priceVersionId: picked.priceVersionId, quantity: 1 },
      { onSuccess: () => setPicked(null) },
    );

  return (
    <Screen
      title="상점"
      subtitle={`${format.formatPoints(available)} 보유 중`}
      onBack={() => navigation.goBack()}
      padded={false}>
      <ErrorBanner error={order.error} />

      <QueryState query={items} emptyTitle="지금은 살 수 있는 물건이 없어요">
        {(list) => (
          <FlatList
            data={list}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshing={items.isFetching}
            onRefresh={() => {
              items.refetch();
              balance.refetch();
              inventory.refetch();
            }}
            renderItem={({ item }) => {
              const owned = item.itemKind === 'permanent' && item.ownedQuantity > 0;
              const tooExpensive = item.pricePoints > available;

              return (
                <Card style={styles.card}>
                  <View style={styles.topRow}>
                    <Text style={styles.name}>{item.name}</Text>
                    <StatusTag
                      text={labels.shopItemKind[item.itemKind]}
                      tone={item.itemKind === 'permanent' ? 'primary' : 'neutral'}
                    />
                  </View>

                  {!!item.description && (
                    <Text style={styles.description}>{item.description}</Text>
                  )}

                  <View style={styles.bottomRow}>
                    <Text style={styles.price}>{format.formatPoints(item.pricePoints)}</Text>
                    {owned ? (
                      <StatusTag text="보유 중" tone="success" />
                    ) : (
                      <Button
                        title={tooExpensive ? '포인트 부족' : '교환'}
                        size="sm"
                        onPress={() => setPicked(item)}
                        disabled={tooExpensive}
                      />
                    )}
                  </View>

                  {item.ownedQuantity > 0 && item.itemKind === 'consumable' && (
                    <Text style={styles.owned}>보유 {item.ownedQuantity}개</Text>
                  )}
                </Card>
              );
            }}
          />
        )}
      </QueryState>

      <ConfirmDialog
        visible={!!picked}
        title="이 물건으로 바꿀까요?"
        message={
          picked
            ? `${picked.name} · ${format.formatPoints(picked.pricePoints)}\n남는 포인트 ${format.formatPoints(available - picked.pricePoints)}`
            : ''
        }
        confirmText="교환하기"
        loading={order.isPending}
        onConfirm={buy}
        onCancel={() => setPicked(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  card: { gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  description: { ...typography.caption, color: colors.textSub },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { ...typography.subtitle, color: colors.primary },
  owned: { ...typography.caption, color: colors.textSub },
});
