// AUTH-05 약관 동의
//
// 서버가 주는 현재 약관 문서를 모두 보여 주고 동의를 받는다.
// 필수 문서를 모두 켜야 다음으로 갈 수 있고, 선택 문서는 꺼 둔 채로도 진행된다.
// 모은 동의 목록은 가입 요청에 그대로 실려야 하므로 다음 화면들로 전달한다.
//
// 휴대폰 가입이면 번호 입력으로, 소셜 가입이면 닉네임 설정으로 간다.
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { labels, useCurrentPolicies } from '../../client';
import { Button, Card, QueryState, Screen } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

export default function TermsAgreementScreen({ navigation, route }) {
  const { purpose = 'phone', socialSignupToken } = route.params ?? {};
  const policies = useCurrentPolicies();
  const [granted, setGranted] = useState({});

  const documents = useMemo(() => policies.data ?? [], [policies.data]);
  const allRequiredGranted = useMemo(
    () => documents.filter((d) => d.isRequired).every((d) => granted[d.id]),
    [documents, granted],
  );

  const toggle = (id) => setGranted((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleAll = () => {
    const turnOn = !documents.every((d) => granted[d.id]);
    setGranted(Object.fromEntries(documents.map((d) => [d.id, turnOn])));
  };

  const next = () => {
    const consents = documents.map((d) => ({
      documentVersionId: d.id,
      granted: Boolean(granted[d.id]),
    }));

    if (purpose === 'social') {
      navigation.navigate(Routes.NICKNAME_SETUP, { socialSignupToken, consents });
    } else {
      navigation.navigate(Routes.PHONE_NUMBER, { purpose: 'signup', consents });
    }
  };

  return (
    <Screen title="약관 동의" onBack={() => navigation.goBack()} padded={false}>
      <QueryState query={policies} emptyTitle="약관을 불러오지 못했어요">
        {(docs) => (
          <>
            <ScrollView contentContainerStyle={styles.body}>
              <Card>
                <View style={styles.allRow}>
                  <Text style={styles.allLabel}>약관 전체 동의</Text>
                  <Switch
                    value={docs.every((d) => granted[d.id])}
                    onValueChange={toggleAll}
                    trackColor={{ true: colors.primary }}
                  />
                </View>
              </Card>

              {docs.map((doc) => (
                <Card key={doc.id} style={styles.docCard}>
                  <View style={styles.docHeader}>
                    <Text style={styles.docTitle}>
                      {doc.isRequired ? '[필수] ' : '[선택] '}
                      {labels.policyDocumentType[doc.documentType] ?? doc.documentType}
                    </Text>
                    <Switch
                      value={Boolean(granted[doc.id])}
                      onValueChange={() => toggle(doc.id)}
                      trackColor={{ true: colors.primary }}
                    />
                  </View>
                  <Text style={styles.version}>버전 {doc.version}</Text>
                  <ScrollView style={styles.bodyBox} nestedScrollEnabled>
                    <Text style={styles.bodyText}>{doc.body}</Text>
                  </ScrollView>
                </Card>
              ))}
            </ScrollView>

            <View style={styles.footer}>
              <Button title="동의하고 계속하기" onPress={next} disabled={!allRequiredGranted} full />
            </View>
          </>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  allRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  allLabel: { ...typography.bodyStrong, color: colors.text },
  docCard: { gap: spacing.xs },
  docHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  docTitle: { ...typography.body, color: colors.text, flex: 1 },
  version: { ...typography.caption, color: colors.textSub },
  bodyBox: {
    maxHeight: 110,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  bodyText: { ...typography.caption, color: colors.textSub },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
