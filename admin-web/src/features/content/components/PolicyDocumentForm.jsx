import { useState } from 'react';
import { Alert, Button, Card, Input, Radio, Switch } from 'antd';
import { policyDocumentType } from '../labels.js';
import { useCreatePolicyDocument } from '../queries.js';
import { fromInputValue } from '../time.js';
import { Field } from './Field.jsx';
import { formStyle } from './formStyle.js';

const VERSION_MAX_LENGTH = 20;
const typeOptions = Object.entries(policyDocumentType).map(([value, label]) => ({ value, label }));

/**
 * The form of a new, not yet published policy version (M96). The reason of the audit log is asked
 * by the confirm step of the page (`onConfirm`).
 * @param {object} props
 * @param {(request: object) => void} props.onConfirm
 * @param {() => void} props.onClose
 */
export function PolicyDocumentForm({ onConfirm, onClose }) {
  const create = useCreatePolicyDocument();
  const [form, setForm] = useState({
    documentType: 'terms',
    version: '',
    body: '',
    effectiveAt: '',
    requiresReconsent: false,
  });
  const [error, setError] = useState(null);

  const set = (patch) => {
    setForm((current) => ({ ...current, ...patch }));
    setError(null);
  };

  const handleSave = () => {
    const version = form.version.trim();
    const body = form.body.trim();
    if (!version) return setError('버전을 입력해 주세요.');
    if (!body) return setError('본문을 입력해 주세요.');
    if (!form.effectiveAt) return setError('시행 시각을 입력해 주세요.');
    const input = {
      documentType: form.documentType,
      version,
      body,
      effectiveAt: fromInputValue(form.effectiveAt),
      requiresReconsent: form.requiresReconsent,
    };
    onConfirm({
      title: '새 버전 저장',
      summary: (
        <>
          {policyDocumentType[input.documentType]} {input.version}
          <br />
          게시하기 전까지는 회원에게 보이지 않아요.
        </>
      ),
      submit: async ({ reason, idempotencyKey }) => {
        await create.mutateAsync({ body: { ...input, reason }, idempotencyKey });
        onClose();
      },
    });
  };

  return (
    <Card title="새 버전 만들기">
      <div style={formStyle}>
        <Field label="문서 종류">
          <Radio.Group
            value={form.documentType}
            onChange={(event) => set({ documentType: event.target.value })}
            options={typeOptions}
          />
        </Field>
        <Field label="버전">
          <Input
            aria-label="버전"
            maxLength={VERSION_MAX_LENGTH}
            style={{ maxWidth: 200 }}
            value={form.version}
            onChange={(event) => set({ version: event.target.value })}
          />
        </Field>
        <Field label="본문">
          <Input.TextArea
            aria-label="본문"
            rows={10}
            value={form.body}
            onChange={(event) => set({ body: event.target.value })}
          />
        </Field>
        <Field label="시행 시각 (한국 시간)">
          <Input
            type="datetime-local"
            aria-label="시행 시각"
            style={{ maxWidth: 240 }}
            value={form.effectiveAt}
            onChange={(event) => set({ effectiveAt: event.target.value })}
          />
        </Field>
        <Field label="다시 동의 받기" hint="켜면 회원이 이 버전에 다시 동의해야 해요.">
          <Switch
            aria-label="다시 동의 받기"
            checked={form.requiresReconsent}
            onChange={(checked) => set({ requiresReconsent: checked })}
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
