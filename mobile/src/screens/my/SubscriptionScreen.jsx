// MY-12 구독
//
// 구독은 아직 만들지 않은 기능이다. 서버가 `COMMON_NOT_IMPLEMENTED`로 답하므로
// 이 화면은 그 응답을 "준비 중" 안내로 바꿔 보여 주고 다시 시도하지 않는다.
//
// 혹시 서버가 구독 정보를 주기 시작하면 그 값을 그대로 보여 준다 — 화면이
// 요금이나 혜택을 지어내지 않는다.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useSubscription } from '../../client';
import { Button, Card, Icon, Screen } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

export default function SubscriptionScreen({ navigation }) {
  const subscription = useSubscription();

  const notReady =
    subscription.isError && subscription.error?.code === 'COMMON_NOT_IMPLEMENTED';

  return (
    <Screen title="구독" onBack={() => navigation.goBack()} padded={false}>
      <ScrollView contentContainerStyle={styles.body}>
        {subscription.isLoading && <Text style={styles.loading}>확인하고 있어요…</Text>}

        {notReady && (
          <View style={styles.hero}>
            <Icon name="star" size={48} color={colors.warning} />
            <Text style={styles.heading}>구독은 준비 중이에요</Text>
            <Text style={styles.description}>
              아직 열지 않은 기능이에요.{'\n'}열리면 공지와 알림으로 알려 드릴게요.
            </Text>
            <Button
              title="공지사항 보기"
              variant="secondary"
              onPress={() => navigation.navigate(Routes.NOTICE_LIST)}
            />
          </View>
        )}

        {subscription.isError && !notReady && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>
              {subscription.error?.message ?? '구독 정보를 가져오지 못했어요.'}
            </Text>
            <Button title="다시 시도" size="sm" onPress={() => subscription.refetch()} />
          </Card>
        )}

        {!!subscription.data && (
          <Card style={styles.card}>
            <Text style={styles.cardLabel}>내 구독</Text>
            <Text style={styles.cardText}>{JSON.stringify(subscription.data)}</Text>
          </Card>
        )}

        <Card style={styles.freeCard}>
          <Text style={styles.freeTitle}>지금은 모든 기능을 무료로 쓸 수 있어요</Text>
          <Text style={styles.freeText}>
            목표 세우기, AI 계획, 미션 인증, 펫 키우기, 챌린지까지 모두 열려 있어요.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  loading: { ...typography.body, color: colors.textSub, textAlign: 'center', padding: spacing.xl },
  hero: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  heading: { ...typography.title, color: colors.text },
  description: { ...typography.body, color: colors.textSub, textAlign: 'center' },
  errorCard: { gap: spacing.sm, alignItems: 'flex-start' },
  errorText: { ...typography.body, color: colors.danger },
  card: { gap: spacing.xs },
  cardLabel: { ...typography.caption, color: colors.textSub },
  cardText: { ...typography.body, color: colors.text },
  freeCard: { gap: spacing.xs },
  freeTitle: { ...typography.bodyStrong, color: colors.text },
  freeText: { ...typography.caption, color: colors.textSub },
});
