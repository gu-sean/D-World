// MY-04 알림함
//
// 받은 알림을 최근 순으로 보여 준다. 안 읽은 알림만 걸러 볼 수 있고, 하나를
// 누르면 읽음으로 바꾸고 알림이 가리키는 화면으로 넘어간다.
//
// 가리키는 화면은 서버가 준 `linkScreen` 문자열이 정하므로 화면 이름을 직접
// 짐작하지 않고 `openLink`에 맡긴다.
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import {
  format,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '../../client';
import { Button, Card, ErrorBanner, Icon, QueryState, Screen } from '../../components';
import openLink from '../../navigation/linking';
import { colors, spacing, typography } from '../../theme';

export default function NotificationInboxScreen({ navigation }) {
  const [unreadOnly, setUnreadOnly] = useState(false);

  const notifications = useNotifications({ unreadOnly: unreadOnly || undefined });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const unread = notifications.unreadCount;

  const open = (item) => {
    if (!item.readAt) markRead.mutate({ notificationId: item.id });
    if (item.linkScreen) openLink(item.linkScreen, navigation);
  };

  return (
    <Screen
      title="알림함"
      subtitle={unread != null ? `안 읽음 ${unread}개` : undefined}
      onBack={() => navigation.goBack()}
      padded={false}
      right={
        <Button
          title="모두 읽음"
          variant="text"
          size="sm"
          onPress={() => markAll.mutate({})}
          loading={markAll.isPending}
          disabled={!unread}
        />
      }>
      <ErrorBanner error={markRead.error ?? markAll.error} />

      <View style={styles.filter}>
        <Button
          title={unreadOnly ? '안 읽은 것만 ✓' : '안 읽은 것만'}
          variant={unreadOnly ? 'primary' : 'secondary'}
          size="sm"
          onPress={() => setUnreadOnly((prev) => !prev)}
        />
      </View>

      <QueryState
        query={notifications}
        data={notifications.items}
        isEmpty={notifications.items.length === 0}
        emptyTitle="알림이 없어요"
        emptyText="미션을 하면 인증 결과와 보상 소식이 여기로 와요.">
        {(list) => (
          <FlatList
            data={list}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshing={notifications.isFetching && !notifications.isFetchingNextPage}
            onRefresh={notifications.refetch}
            onEndReached={() => notifications.hasNextPage && notifications.fetchNextPage()}
            onEndReachedThreshold={0.4}
            renderItem={({ item }) => (
              <Card onPress={() => open(item)} style={styles.card}>
                <View style={styles.topRow}>
                  {!item.readAt && <View style={styles.dot} />}
                  <Text style={[styles.title, !item.readAt && styles.titleUnread]}>
                    {item.title}
                  </Text>
                  {!!item.linkScreen && (
                    <Icon name="chevronRight" size={16} color={colors.textSub} />
                  )}
                </View>
                <Text style={styles.body} numberOfLines={3}>
                  {item.body}
                </Text>
                <Text style={styles.time}>{format.formatRelative(item.createdAt)}</Text>
              </Card>
            )}
          />
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filter: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, alignItems: 'flex-start' },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  card: { gap: spacing.xs },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  title: { ...typography.body, color: colors.text, flex: 1 },
  titleUnread: { ...typography.bodyStrong, color: colors.text },
  body: { ...typography.caption, color: colors.textSub },
  time: { ...typography.caption, color: colors.textSub },
});
