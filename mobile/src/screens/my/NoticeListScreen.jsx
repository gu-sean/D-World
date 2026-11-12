// MY-05 공지 목록
//
// 게시된 공지를 최근 순으로 보여 준다. 종류(서비스·이벤트·정책·마케팅)로
// 걸러 볼 수 있고, 한 줄을 누르면 상세로 간다.
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { format, labels, useNotices } from '../../client';
import { Card, OptionRow, QueryState, Screen, StatusTag } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const CATEGORIES = [
  { value: 'all', label: '전체' },
  { value: 'service', label: '서비스' },
  { value: 'event', label: '이벤트' },
  { value: 'policy', label: '정책' },
];

export default function NoticeListScreen({ navigation }) {
  const [category, setCategory] = useState('all');

  const notices = useNotices({ category: category === 'all' ? undefined : category });

  return (
    <Screen title="공지사항" onBack={() => navigation.goBack()} padded={false}>
      <View style={styles.filter}>
        <OptionRow options={CATEGORIES} value={category} onChange={setCategory} />
      </View>

      <QueryState
        query={notices}
        data={notices.items}
        isEmpty={notices.items.length === 0}
        emptyTitle="공지가 없어요">
        {(list) => (
          <FlatList
            data={list}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshing={notices.isFetching && !notices.isFetchingNextPage}
            onRefresh={notices.refetch}
            onEndReached={() => notices.hasNextPage && notices.fetchNextPage()}
            onEndReachedThreshold={0.4}
            renderItem={({ item }) => (
              <Card
                onPress={() => navigation.navigate(Routes.NOTICE_DETAIL, { noticeId: item.id })}
                style={styles.card}>
                <View style={styles.topRow}>
                  <StatusTag text={labels.noticeCategory[item.category]} tone="neutral" />
                  <Text style={styles.date}>{format.formatDate(item.publishedAt)}</Text>
                </View>
                <Text style={styles.title} numberOfLines={2}>
                  {item.title}
                </Text>
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
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { ...typography.caption, color: colors.textSub },
  title: { ...typography.bodyStrong, color: colors.text },
});
