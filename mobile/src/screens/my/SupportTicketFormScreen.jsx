// MY-08 문의·신고 올리기
//
// `ticketType`에 따라 고를 수 있는 분류가 달라진다 — 문의는 계정·미션·인증·포인트·
// 챌린지·기타, 신고는 욕설·부적절한 내용·부정 인증·사칭·기타.
//
// 신고는 대상이 반드시 있어야 하므로, 신고 대상 없이 들어왔으면 그 사실을 알리고
// 보내지 않는다 — 대상은 신고 버튼이 있던 화면(회원·미션·챌린지)에서 넘겨 준다.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { labels, useCreateSupportTicket, validators } from '../../client';
import {
  Button,
  Card,
  ErrorBanner,
  OptionRow,
  Screen,
  TextField,
} from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const INQUIRY = ['account', 'mission', 'verification', 'points', 'challenge', 'other'];
const REPORT = ['abuse', 'inappropriate_content', 'cheating', 'impersonation', 'other'];

export default function SupportTicketFormScreen({ navigation, route }) {
  const { ticketType = 'inquiry', targetKind, targetId } = route.params ?? {};
  const isReport = ticketType === 'report';

  const createTicket = useCreateSupportTicket();

  const [form, setForm] = useState({ category: null, subject: '', body: '' });
  const [touched, setTouched] = useState(false);

  const set = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setTouched(true);
  };

  const options = (isReport ? REPORT : INQUIRY).map((code) => ({
    value: code,
    label: labels.ticketCategory[code],
  }));

  const subjectCheck = validators.validateLength(form.subject, 'supportTitle');
  const bodyCheck = validators.validateLength(form.body, 'supportBody');
  const targetMissing = isReport && (!targetKind || !targetId);
  const ready = subjectCheck.ok && bodyCheck.ok && !!form.category && !targetMissing;

  const submit = () =>
    createTicket.mutate(
      {
        ticketType,
        category: form.category,
        subject: form.subject.trim(),
        body: form.body.trim(),
        targetKind: isReport ? targetKind : null,
        targetId: isReport ? targetId : null,
      },
      {
        onSuccess: (ticket) => {
          if (ticket?.id) {
            navigation.replace(Routes.SUPPORT_TICKET_DETAIL, { ticketId: ticket.id });
          } else {
            navigation.goBack();
          }
        },
      },
    );

  return (
    <Screen
      title={isReport ? '신고하기' : '문의하기'}
      onBack={() => navigation.goBack()}
      padded={false}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <ErrorBanner error={createTicket.error} />

        {targetMissing && (
          <Card style={styles.warnCard}>
            <Text style={styles.warnText}>
              신고는 신고할 대상이 있어야 올릴 수 있어요. 신고하려는 회원·미션·챌린지
              화면에서 신고 버튼을 눌러 주세요.
            </Text>
          </Card>
        )}

        {isReport && !targetMissing && (
          <Card style={styles.targetCard}>
            <Text style={styles.targetLabel}>신고 대상</Text>
            <Text style={styles.targetText}>{labels.ticketTargetKind[targetKind]}</Text>
          </Card>
        )}

        <OptionRow
          label="분류"
          options={options}
          value={form.category}
          onChange={set('category')}
        />

        <TextField
          label="제목"
          value={form.subject}
          onChangeText={set('subject')}
          placeholder={isReport ? '무엇을 신고하시나요?' : '무엇이 궁금하신가요?'}
          maxLength={120}
          error={touched && !subjectCheck.ok ? subjectCheck.message : null}
        />

        <TextField
          label="내용"
          value={form.body}
          onChangeText={set('body')}
          placeholder="언제, 어떤 화면에서, 무슨 일이 있었는지 적어 주시면 빠르게 확인할 수 있어요."
          multiline
          maxLength={2000}
          hint="연락처·주소 같은 개인정보는 적지 마세요."
          error={touched && !bodyCheck.ok ? bodyCheck.message : null}
        />

        <Button
          title={isReport ? '신고 보내기' : '문의 보내기'}
          onPress={submit}
          loading={createTicket.isPending}
          disabled={!ready}
          full
        />

        <Text style={styles.note}>
          답변은 알림으로 알려 드리고, 문의 상세에서도 확인할 수 있어요.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  warnCard: {},
  warnText: { ...typography.body, color: colors.warning },
  targetCard: { gap: spacing.xs },
  targetLabel: { ...typography.caption, color: colors.textSub },
  targetText: { ...typography.body, color: colors.text },
  note: { ...typography.caption, color: colors.textSub, textAlign: 'center' },
});
