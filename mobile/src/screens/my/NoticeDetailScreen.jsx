// MY-06 공지 상세
//
// 공지 하나의 전문을 보여 준다. 공지가 앱 안의 특정 화면을 가리키면
// 아래에 그곳으로 가는 버튼이 붙는다.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { format, labels, useNotice } from '../../client';
import { Button, QueryState, Screen, StatusTag } from '../../components';
import openLink from '../../navigation/linking';
import { colors, spacing, typography } from '../../theme';

export default function NoticeDetailScreen({ navigation, route }) {
  const { noticeId } = route.params ?? {};
  const notice = useNotice(noticeId);

  return (
    <Screen title="공지" onBack={() => navigation.goBack()} padded={false}>
      <QueryState query={notice}>
        {(data) => (
          <ScrollView contentContainerStyle={styles.body}>
            <View style={styles.head}>
              <StatusTag text={labels.noticeCategory[data.category]} tone="neutral" />
              <Text style={styles.title}>{data.title}</Text>
              <Text style={styles.date}>{format.formatDateTime(data.publishedAt)}</Text>
            </View>

            <Text style={styles.text}>{data.body}</Text>

            {!!data.linkScreen && (
              <Button
                title="바로 가기"
                variant="secondary"
                onPress={() => openLink(data.linkScreen, navigation)}
                full
              />
            )}
          </ScrollView>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  head: { gap: spacing.xs, alignItems: 'flex-start' },
  title: { ...typography.title, color: colors.text },
  date: { ...typography.caption, color: colors.textSub },
  text: { ...typography.body, color: colors.text, lineHeight: 24 },
});
