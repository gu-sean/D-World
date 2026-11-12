// MY-02 약관 재동의
//
// 약관이 바뀌어 다시 동의가 필요할 때 쓰는 화면. 다시 동의할 문서는 내 정보의
// `pendingConsents`에만 들어 있으므로 그 목록을 그대로 보여 준다.
//
// 필수 문서를 모두 켜야 보낼 수 있고, 선택 문서는 꺼 둔 채로 보낼 수 있다.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { labels, useMe, useSubmitConsents } from '../../client';
import { Button, Card, ErrorBanner, QueryState, Screen } from '../../components';
import { colors, spacing, typography } from '../../theme';

export default function ReconsentScreen({ navigation }) {
  const [granted, setGranted] = useState({});

  const me = useMe();
  const submit = useSubmitConsents();

  const documents = me.data?.pendingConsents ?? [];
  const requiredDone = documents.filter((doc) => doc.isRequired).every((doc) => granted[doc.id]);

  const send = () =>
    submit.mutate(
      {
        consents: documents.map((doc) => ({
          documentVersionId: doc.id,
          granted: Boolean(granted[doc.id]),
        })),
      },
      { onSuccess: () => navigation.goBack() },
    );

  return (
    <Screen title="약관 재동의" onBack={() => navigation.goBack()} padded={false}>
      <ErrorBanner error={submit.error} />

      <QueryState
        query={me}
        data={documents}
        isEmpty={documents.length === 0}
        emptyTitle="다시 동의할 약관이 없어요">
        {(list) => (
          <>
            <ScrollView contentContainerStyle={styles.body}>
              <Text style={styles.hint}>
                약관이 바뀌었어요. 내용을 확인하고 다시 동의해 주세요.
              </Text>

              {list.map((doc) => (
                <Card key={doc.id} style={styles.card}>
                  <View style={styles.topRow}>
                    <Text style={styles.title}>
                      {doc.isRequired ? '[필수] ' : '[선택] '}
                      {labels.policyDocumentType[doc.documentType]}
                    </Text>
                    <Switch
                      value={!!granted[doc.id]}
                      onValueChange={() =>
                        setGranted((prev) => ({ ...prev, [doc.id]: !prev[doc.id] }))
                      }
                    />
                  </View>
                  <Text style={styles.version}>{doc.version} 버전</Text>
                  {!!doc.body && (
                    <Text style={styles.summary} numberOfLines={6}>
                      {doc.body}
                    </Text>
                  )}
                </Card>
              ))}
            </ScrollView>

            <View style={styles.footer}>
              <Button
                title="동의하고 계속하기"
                onPress={send}
                loading={submit.isPending}
                disabled={!requiredDone}
                full
              />
            </View>
          </>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  hint: { ...typography.body, color: colors.textSub },
  card: { gap: spacing.xs },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  version: { ...typography.caption, color: colors.textSub },
  summary: { ...typography.caption, color: colors.textSub },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
