// MY-09 문의 상세
//
// 내가 올린 내용과 운영팀 답변을 시간 순으로 보여 준다. 답변은 사용자에게
// 공개된 것만 내려오므로 받은 그대로 싣는다.
//
// 아직 답변이 없으면 기다리는 중이라는 것을 분명히 알려 준다.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { format, labels, useSupportTicket } from '../../client';
import { Card, QueryState, Screen, StatusTag } from '../../components';
import { colors, spacing, typography } from '../../theme';

const TONE = { received: 'warning', in_review: 'primary', completed: 'success' };

export default function SupportTicketDetailScreen({ navigation, route }) {
  const { ticketId } = route.params ?? {};
  const ticket = useSupportTicket(ticketId);

  return (
    <Screen title="문의 내용" onBack={() => navigation.goBack()} padded={false}>
      <QueryState query={ticket}>
        {(data) => {
          const replies = data.replies ?? [];

          return (
            <ScrollView contentContainerStyle={styles.body}>
              <View style={styles.head}>
                <View style={styles.tagRow}>
                  <StatusTag text={labels.ticketType[data.ticketType]} tone="neutral" />
                  <StatusTag text={labels.ticketCategory[data.category]} tone="neutral" />
                  <StatusTag
                    text={labels.ticketStatus[data.status]}
                    tone={TONE[data.status] ?? 'neutral'}
                  />
                </View>
                <Text style={styles.subject}>{data.subject}</Text>
                <Text style={styles.meta}>
                  {format.formatDateTime(data.receivedAt)} 접수
                  {data.completedAt
                    ? ` · ${format.formatDateTime(data.completedAt)} 완료`
                    : ''}
                </Text>
              </View>

              <Card style={styles.card}>
                <Text style={styles.cardLabel}>내가 쓴 내용</Text>
                <Text style={styles.text}>{data.body}</Text>
              </Card>

              {replies.length === 0 ? (
                <Card style={styles.card}>
                  <Text style={styles.waiting}>
                    {data.status === 'completed'
                      ? '답변 없이 처리가 끝났어요.'
                      : '운영팀이 확인하고 있어요. 답변이 오면 알림으로 알려 드려요.'}
                  </Text>
                </Card>
              ) : (
                replies.map((reply, index) => (
                  <Card key={`${reply.createdAt}-${index}`} style={styles.replyCard}>
                    <Text style={styles.cardLabel}>운영팀 답변</Text>
                    <Text style={styles.text}>{reply.body}</Text>
                    <Text style={styles.meta}>{format.formatDateTime(reply.createdAt)}</Text>
                  </Card>
                ))
              )}
            </ScrollView>
          );
        }}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  head: { gap: spacing.xs },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  subject: { ...typography.title, color: colors.text },
  meta: { ...typography.caption, color: colors.textSub },
  card: { gap: spacing.xs },
  replyCard: { gap: spacing.xs, borderLeftWidth: 3, borderLeftColor: colors.primary },
  cardLabel: { ...typography.caption, color: colors.textSub },
  text: { ...typography.body, color: colors.text, lineHeight: 23 },
  waiting: { ...typography.body, color: colors.textSub },
});
