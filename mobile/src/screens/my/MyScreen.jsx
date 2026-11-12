// MY-01 마이
//
// 마이 탭의 첫 화면. 위에는 내 레벨·포인트·연속 일수 같은 요약을, 아래에는
// 펫·보상·챌린지·알림·설정으로 가는 메뉴를 둔다.
//
// 이용 제한을 받고 있거나 다시 동의할 약관이 있으면 가장 위에 먼저 알린다.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { format, labels, useMe, useNotifications } from '../../client';
import {
  Button,
  Card,
  Icon,
  ListRow,
  PetAvatar,
  ProgressBar,
  QueryState,
  Screen,
  SectionTitle,
} from '../../components';
import Routes from '../../navigation/routes';
import { colors, radius, spacing, typography } from '../../theme';

export default function MyScreen({ navigation }) {
  const me = useMe();
  const notifications = useNotifications({ unreadOnly: true });

  const unread = notifications.unreadCount ?? notifications.items.length;

  return (
    <Screen title="마이" padded={false}>
      <QueryState query={me}>
        {(data) => {
          const levelRate =
            data.nextLevelXp && data.nextLevelXp > 0
              ? Math.min(data.totalXp / data.nextLevelXp, 1)
              : 1;

          return (
            <ScrollView contentContainerStyle={styles.body}>
              {!!data.restriction && (
                <Card style={styles.warnCard}>
                  <View style={styles.warnRow}>
                    <Icon name="alert" size={18} color={colors.danger} />
                    <Text style={styles.warnTitle}>이용이 제한된 상태예요</Text>
                  </View>
                  <Text style={styles.warnText}>{data.restriction.reason}</Text>
                  <Text style={styles.warnText}>
                    {format.formatDateTime(data.restriction.endsAt)}까지
                  </Text>
                </Card>
              )}

              {(data.pendingConsents ?? []).length > 0 && (
                <Card style={styles.consentCard}>
                  <Text style={styles.consentTitle}>다시 동의할 약관이 있어요</Text>
                  <Text style={styles.consentText}>
                    {data.pendingConsents
                      .map((doc) => labels.policyDocumentType[doc.documentType])
                      .join(' · ')}
                  </Text>
                  <Button
                    title="약관 확인하기"
                    size="sm"
                    onPress={() => navigation.navigate(Routes.RECONSENT)}
                  />
                </Card>
              )}

              <Card style={styles.profile}>
                <PetAvatar pet={data.representativePet} size={64} />
                <View style={styles.profileText}>
                  <Text style={styles.nickname}>{data.nickname}</Text>
                  <Text style={styles.level}>
                    Lv.{data.levelNo}
                    {!!data.representativeBadge && ` · ${data.representativeBadge.title}`}
                  </Text>
                  <ProgressBar rate={levelRate} height={6} />
                  <Text style={styles.xp}>
                    경험치 {format.formatNumber(data.totalXp)}
                    {data.nextLevelXp
                      ? ` / ${format.formatNumber(data.nextLevelXp)}`
                      : ' (최고 레벨)'}
                  </Text>
                </View>
              </Card>

              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Icon name="coin" size={20} color={colors.primary} />
                  <Text style={styles.statValue}>{format.formatPoints(data.availablePoints)}</Text>
                  <Text style={styles.statLabel}>쓸 수 있는 포인트</Text>
                </View>
                <View style={styles.stat}>
                  <Icon name="flame" size={20} color={colors.warning} />
                  <Text style={styles.statValue}>{data.streakDays}일</Text>
                  <Text style={styles.statLabel}>연속 성공</Text>
                </View>
              </View>

              <SectionTitle title="펫과 보상" />
              <View style={styles.group}>
                <ListRow
                  icon="paw"
                  title="펫"
                  description="내 펫과 도감"
                  onPress={() => navigation.navigate(Routes.PET_ROOM)}
                />
                <ListRow
                  icon="flame"
                  title="연속 기록"
                  onPress={() => navigation.navigate(Routes.STREAK)}
                />
                <ListRow
                  icon="trophy"
                  title="업적"
                  onPress={() => navigation.navigate(Routes.ACHIEVEMENT_LIST)}
                />
                <ListRow
                  icon="coin"
                  title="포인트 내역"
                  value={format.formatPoints(data.availablePoints)}
                  onPress={() => navigation.navigate(Routes.POINT_HISTORY)}
                />
                <ListRow
                  icon="gift"
                  title="상점"
                  onPress={() => navigation.navigate(Routes.SHOP)}
                />
              </View>

              <SectionTitle title="챌린지" />
              <View style={styles.group}>
                <ListRow
                  icon="flag"
                  title="챌린지 둘러보기"
                  onPress={() => navigation.navigate(Routes.CHALLENGE_EXPLORE)}
                />
                <ListRow
                  icon="checklist"
                  title="내 챌린지"
                  onPress={() => navigation.navigate(Routes.MY_CHALLENGES)}
                />
              </View>

              <SectionTitle title="알림과 소식" />
              <View style={styles.group}>
                <ListRow
                  icon="bell"
                  title="알림함"
                  value={unread > 0 ? `${unread}개 안 읽음` : undefined}
                  onPress={() => navigation.navigate(Routes.NOTIFICATION_INBOX)}
                />
                <ListRow
                  icon="book"
                  title="공지사항"
                  onPress={() => navigation.navigate(Routes.NOTICE_LIST)}
                />
              </View>

              <SectionTitle title="내 계정" />
              <View style={styles.group}>
                <ListRow
                  icon="user"
                  title="프로필 수정"
                  onPress={() => navigation.navigate(Routes.PROFILE_EDIT)}
                />
                <ListRow
                  icon="search"
                  title="문의·신고"
                  onPress={() => navigation.navigate(Routes.SUPPORT_TICKET_LIST)}
                />
                <ListRow
                  icon="star"
                  title="구독"
                  onPress={() => navigation.navigate(Routes.SUBSCRIPTION)}
                />
                <ListRow
                  icon="gear"
                  title="설정"
                  onPress={() => navigation.navigate(Routes.SETTINGS)}
                />
              </View>
            </ScrollView>
          );
        }}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  warnCard: { gap: spacing.xs },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  warnTitle: { ...typography.bodyStrong, color: colors.danger },
  warnText: { ...typography.caption, color: colors.textSub },
  consentCard: { gap: spacing.sm, alignItems: 'flex-start' },
  consentTitle: { ...typography.bodyStrong, color: colors.text },
  consentText: { ...typography.caption, color: colors.textSub },
  profile: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  profileText: { flex: 1, gap: spacing.xs },
  nickname: { ...typography.title, color: colors.text },
  level: { ...typography.caption, color: colors.textSub },
  xp: { ...typography.caption, color: colors.textSub },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: { ...typography.subtitle, color: colors.text },
  statLabel: { ...typography.caption, color: colors.textSub },
  group: { backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden' },
});
