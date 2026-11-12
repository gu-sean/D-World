// MY-07 문의·신고 목록
//
// 내가 올린 문의와 신고를 최근 순으로 보여 준다. 접수·검토 중·완료 상태를
// 태그로 구분하고, 새 문의나 신고를 바로 올릴 수 있는 버튼을 위에 둔다.
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { format, labels, useMySupportTickets } from '../../client';
import { Button, Card, OptionRow, QueryState, Screen, StatusTag } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const TYPES = [
  { value: 'all', label: '전체' },
  { value: 'inquiry', label: '문의' },
  { value: 'report', label: '신고' },
];

const TONE = { received: 'warning', in_review: 'primary', completed: 'success' };

export default function SupportTicketListScreen({ navigation }) {
  const [ticketType, setTicketType] = useState('all');

  const tickets = useMySupportTickets({
    ticketType: ticketType === 'all' ? undefined : ticketType,
  });

  return (
    <Screen title="문의·신고" onBack={() => navigation.goBack()} padded={false}>
      <View style={styles.top}>
        <OptionRow options={TYPES} value={ticketType} onChange={setTicketType} />
        <View style={styles.buttons}>
          <Button
            title="문의하기"
            size="sm"
            onPress={() =>
              navigation.navigate(Routes.SUPPORT_TICKET_FORM, { ticketType: 'inquiry' })
            }
          />
          <Button
            title="신고하기"
            variant="secondary"
            size="sm"
            onPress={() =>
              navigation.navigate(Routes.SUPPORT_TICKET_FORM, { ticketType: 'report' })
            }
          />
        </View>
      </View>

      <QueryState
        query={tickets}
        data={tickets.items}
        isEmpty={tickets.items.length === 0}
        emptyTitle="올린 문의가 없어요"
        emptyText="문제가 생기면 언제든 알려 주세요.">
        {(list) => (
          <FlatList
            data={list}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshing={tickets.isFetching && !tickets.isFetchingNextPage}
            onRefresh={tickets.refetch}
            onEndReached={() => tickets.hasNextPage && tickets.fetchNextPage()}
            onEndReachedThreshold={0.4}
            renderItem={({ item }) => (
              <Card
                onPress={() =>
                  navigation.navigate(Routes.SUPPORT_TICKET_DETAIL, { ticketId: item.id })
                }
                style={styles.card}>
                <View style={styles.topRow}>
                  <StatusTag text={labels.ticketType[item.ticketType]} tone="neutral" />
                  <StatusTag
                    text={labels.ticketStatus[item.status]}
                    tone={TONE[item.status] ?? 'neutral'}
                  />
                  <Text style={styles.date}>{format.formatDate(item.receivedAt)}</Text>
                </View>

                <Text style={styles.subject} numberOfLines={2}>
                  {item.subject}
                </Text>

                {(item.replies ?? []).length > 0 && (
                  <Text style={styles.replies}>답변 {item.replies.length}개</Text>
                )}
              </Card>
            )}
          />
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { padding: spacing.lg, paddingBottom: 0, gap: spacing.sm, alignItems: 'flex-start' },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  card: { gap: spacing.xs },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  date: { ...typography.caption, color: colors.textSub },
  subject: { ...typography.bodyStrong, color: colors.text },
  replies: { ...typography.caption, color: colors.primary },
});
