import { useState } from 'react';
import { Alert, Button, Card, Input, Radio, Select, Switch } from 'antd';
import { labels } from '../../../constants/labels.js';
import { ID_PATTERN } from '../../../api/ids.js';
import { audienceType as audienceLabels, policyDocumentType } from '../labels.js';
import { useCreateNotice, usePolicyDocuments, useUpdateNotice } from '../queries.js';
import { fromInputValue, isFuture, toInputValue } from '../time.js';
import { Field } from './Field.jsx';
import { formStyle } from './formStyle.js';

const TITLE_MAX_LENGTH = 100; // docs/09 M91
const BODY_MAX_LENGTH = 5000;
const LINK_SCREEN_PATTERN = /^[a-z][A-Za-z0-9_/.-]*$/; // docs/07 §17 (DB constraint)

const categoryOptions = Object.entries(labels.noticeCategory).map(([value, { text }]) => ({
  value,
  label: text,
}));
const audienceOptions = Object.entries(audienceLabels).map(([value, label]) => ({ value, label }));

// The user ids are typed separated by spaces, commas or new lines.
const splitIds = (text) => text.split(/[\s,]+/).filter(Boolean);

function initialState(notice, pushMode) {
  return {
    category: notice?.category ?? 'service',
    title: notice?.title ?? '',
    body: notice?.body ?? '',
    linkScreen: notice?.linkScreen ?? '',
    audienceType: notice?.audienceType ?? 'all',
    userIdsText: (notice?.userIds ?? []).join('\n'),
    showInList: notice?.showInList ?? true,
    sendPush: pushMode ? true : (notice?.sendPush ?? false),
    policyDocumentVersionId: notice?.policyDocumentVersionId ?? undefined,
    scheduledAt: toInputValue(notice?.scheduledAt),
  };
}

/** The first thing wrong with the form as a text, or null. */
function validate(form, locked) {
  if (!form.title.trim()) return '제목을 입력해 주세요.';
  if (!form.body.trim()) return '내용을 입력해 주세요.';
  if (form.linkScreen && !LINK_SCREEN_PATTERN.test(form.linkScreen)) {
    return '이동 화면은 영문 소문자로 시작하는 값(예: notices/123)으로 입력해 주세요.';
  }
  // 게시·예약한 공지는 내용만 보내므로 받는 회원·예약 시각은 검사하지 않는다
  if (locked) return null;
  if (form.audienceType === 'users') {
    const ids = splitIds(form.userIdsText);
    if (ids.length === 0) return '받을 회원의 ID를 입력해 주세요.';
    if (!ids.every((id) => ID_PATTERN.test(id))) return '회원 ID는 8자 영문·숫자로 입력해 주세요.';
  }
  if (form.category === 'policy' && !form.policyDocumentVersionId) {
    return '정책 공지는 약관 버전을 선택해 주세요.';
  }
  if (form.scheduledAt && !isFuture(form.scheduledAt)) return '예약 시각은 지금 이후여야 해요.';
  return null;
}

/** The body of M91 / M92 without the `reason`. */
function toInput(form, locked) {
  // 게시·예약한 공지: 내용(분류·제목·본문·이동 화면)만 고친다 (백엔드 M92, migration 015)
  if (locked) {
    return {
      category: form.category,
      title: form.title.trim(),
      body: form.body.trim(),
      ...(form.linkScreen ? { linkScreen: form.linkScreen } : {}),
    };
  }
  const input = {
    category: form.category,
    title: form.title.trim(),
    body: form.body.trim(),
    audienceType: form.audienceType,
    showInList: form.showInList,
    sendPush: form.sendPush,
  };
  if (form.linkScreen) input.linkScreen = form.linkScreen;
  if (form.audienceType === 'users') input.userIds = splitIds(form.userIdsText);
  if (form.category === 'policy') input.policyDocumentVersionId = form.policyDocumentVersionId;
  if (form.scheduledAt) input.scheduledAt = fromInputValue(form.scheduledAt);
  return input;
}

/**
 * The form that makes a notice (M91) or edits a draft (M92). `pushMode` is ADM-33: the notice is
 * made with `sendPush = true` and that switch cannot be turned off. The reason of the audit log is
 * asked by the confirm step of the page (`onConfirm`).
 * @param {object} props
 * @param {object} [props.notice] a draft to edit; without it a new notice is made
 * @param {boolean} [props.pushMode]
 * @param {(request: object) => void} props.onConfirm
 * @param {() => void} props.onClose
 */
export function NoticeForm({ notice, pushMode = false, onConfirm, onClose }) {
  const create = useCreateNotice();
  const update = useUpdateNotice();
  const policies = usePolicyDocuments({ page: 1, size: 100 });
  const [form, setForm] = useState(() => initialState(notice, pushMode));
  const [error, setError] = useState(null);
  // 게시·예약한 공지를 고칠 때: 받는 회원·노출·푸시·예약·약관 연결은 잠근다
  const locked = Boolean(notice) && notice.status !== 'draft';
  const policyLocked = locked && notice.category === 'policy';

  const set = (patch) => {
    setForm((current) => ({ ...current, ...patch }));
    setError(null);
  };

  const policyOptions = (policies.data?.items ?? []).map((item) => ({
    value: item.id,
    label: `${policyDocumentType[item.documentType] ?? item.documentType} ${item.version}`,
  }));

  const handleSave = () => {
    const problem = validate(form, locked);
    if (problem) {
      setError(problem);
      return;
    }
    const input = toInput(form, locked);
    onConfirm({
      title: notice ? '공지 수정' : '공지 저장',
      summary: locked ? (
        <>
          게시한 공지를 고쳐요: {input.title}
          <br />
          앱의 공지사항에 바로 반영돼요. 이미 보낸 알림 문구는 바뀌지 않아요.
        </>
      ) : (
        <>
          {notice ? '초안을 수정해요' : '초안으로 저장해요'}: {input.title}
          <br />
          저장한 뒤에 목록에서 게시하거나 예약할 수 있어요.
        </>
      ),
      submit: async ({ reason, idempotencyKey }) => {
        const body = { ...input, reason };
        if (notice) await update.mutateAsync({ noticeId: notice.id, body, idempotencyKey });
        else await create.mutateAsync({ body, idempotencyKey });
        onClose();
      },
    });
  };

  return (
    <Card title={notice ? '공지 수정' : pushMode ? '푸시 알림 만들기' : '공지 만들기'}>
      <div style={formStyle}>
        {locked && (
          <Alert
            type="info"
            showIcon
            title="게시·예약한 공지는 분류·제목·내용·이동 화면만 고칠 수 있어요. 받는 회원과 푸시는 이미 정해져서 바꿀 수 없어요."
          />
        )}
        <Field label="분류">
          <Radio.Group
            value={form.category}
            disabled={policyLocked}
            onChange={(event) => set({ category: event.target.value })}
            options={
              locked
                ? categoryOptions.map((option) => ({
                    ...option,
                    disabled: option.value === 'policy' && !policyLocked,
                  }))
                : categoryOptions
            }
          />
        </Field>
        {form.category === 'marketing' && (
          <Alert type="info" showIcon title="마케팅 공지는 마케팅 수신에 동의한 회원에게만 가요." />
        )}
        {form.category === 'policy' && (
          <Field label="약관 버전">
            <Select
              style={{ minWidth: 240 }}
              aria-label="약관 버전"
              placeholder="약관 버전 선택"
              options={policyOptions}
              disabled={locked}
              loading={policies.isLoading}
              value={form.policyDocumentVersionId}
              onChange={(value) => set({ policyDocumentVersionId: value })}
            />
          </Field>
        )}
        <Field label="제목">
          <Input
            aria-label="제목"
            maxLength={TITLE_MAX_LENGTH}
            showCount
            value={form.title}
            onChange={(event) => set({ title: event.target.value })}
          />
        </Field>
        <Field label="내용">
          <Input.TextArea
            aria-label="내용"
            rows={6}
            maxLength={BODY_MAX_LENGTH}
            showCount
            value={form.body}
            onChange={(event) => set({ body: event.target.value })}
          />
        </Field>
        <Field
          label="이동 화면 (선택)"
          hint="알림을 누르면 열리는 앱 화면이에요. 예: home, notices/{noticeId}"
        >
          <Input
            aria-label="이동 화면"
            value={form.linkScreen}
            onChange={(event) => set({ linkScreen: event.target.value.trim() })}
          />
        </Field>
        <Field label="받는 회원">
          <Radio.Group
            value={form.audienceType}
            disabled={locked}
            onChange={(event) => set({ audienceType: event.target.value })}
            options={audienceOptions}
          />
        </Field>
        {form.audienceType === 'users' && (
          <Field label="회원 ID" hint="공백, 쉼표 또는 줄바꿈으로 나누어 입력해요.">
            <Input.TextArea
              aria-label="회원 ID"
              rows={3}
              disabled={locked}
              value={form.userIdsText}
              onChange={(event) => set({ userIdsText: event.target.value })}
            />
          </Field>
        )}
        <Field label="공지 목록에 표시">
          <Switch
            aria-label="공지 목록에 표시"
            checked={form.showInList}
            disabled={locked}
            onChange={(checked) => set({ showInList: checked })}
          />
        </Field>
        <Field
          label="푸시 알림 발송"
          hint={pushMode ? '이 화면에서 만드는 공지는 푸시 알림을 보내요.' : undefined}
        >
          <Switch
            aria-label="푸시 알림 발송"
            checked={form.sendPush}
            disabled={pushMode || locked}
            onChange={(checked) => set({ sendPush: checked })}
          />
        </Field>
        <Field label="예약 시각 (선택, 한국 시간)" hint="게시할 때 다시 고를 수 있어요.">
          <Input
            type="datetime-local"
            aria-label="예약 시각"
            style={{ maxWidth: 240 }}
            disabled={locked}
            value={form.scheduledAt}
            onChange={(event) => set({ scheduledAt: event.target.value })}
          />
        </Field>
        {error && <Alert type="warning" showIcon title={error} />}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" onClick={handleSave}>
            저장
          </Button>
          <Button onClick={onClose}>닫기</Button>
        </div>
      </div>
    </Card>
  );
}
