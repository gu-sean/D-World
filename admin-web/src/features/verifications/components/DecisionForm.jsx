import { useRef } from 'react';
import { Alert, Button, Form, Input, Modal, Radio } from 'antd';
import { newIdempotencyKey } from '../../../api/idempotency.js';
import { reasonRules } from './format.js';

/**
 * Approve / reject form with a confirm dialog. One Idempotency-Key is created per user action:
 * a retry of the same decision (after a failure) reuses it, a changed decision gets a new one.
 * @param {{
 *   labels: {approved: string, rejected: string},
 *   confirmTitle: string,
 *   submitText: string,
 *   maxReason: number,
 *   pending: boolean,
 *   error?: {message: string}|null,
 *   onSubmit: (values: {decision: string, reason: string}, idempotencyKey: string) => Promise<unknown>,
 * }} props
 */
export default function DecisionForm({
  labels,
  confirmTitle,
  submitText,
  maxReason,
  pending,
  error = null,
  onSubmit,
}) {
  const [form] = Form.useForm();
  const keyRef = useRef(null);

  const keyFor = (values) => {
    const signature = `${values.decision}\n${values.reason}`;
    if (keyRef.current?.signature !== signature) {
      keyRef.current = { signature, key: newIdempotencyKey() };
    }
    return keyRef.current.key;
  };

  const handleFinish = (values) => {
    const decision = labels[values.decision];
    Modal.confirm({
      title: confirmTitle,
      content: `"${decision}"(으)로 처리합니다. 처리 후에는 되돌릴 수 없습니다.`,
      okText: decision,
      cancelText: '취소',
      okButtonProps: { danger: values.decision === 'rejected' },
      onOk: async () => {
        const key = keyFor(values);
        try {
          await onSubmit(values, key);
          keyRef.current = null;
          form.resetFields();
        } catch {
          // The error is shown by the `error` prop; the same key is reused on retry.
        }
      },
    });
  };

  return (
    <Form form={form} layout="vertical" onFinish={handleFinish} disabled={pending}>
      <Form.Item
        label="판정"
        name="decision"
        rules={[{ required: true, message: '판정을 선택해 주세요.' }]}
      >
        <Radio.Group>
          <Radio value="approved">{labels.approved}</Radio>
          <Radio value="rejected">{labels.rejected}</Radio>
        </Radio.Group>
      </Form.Item>
      <Form.Item label="사유" name="reason" rules={reasonRules(maxReason)}>
        <Input.TextArea rows={4} maxLength={maxReason} showCount />
      </Form.Item>
      {error && (
        <Alert type="error" showIcon message={error.message} style={{ marginBottom: 16 }} />
      )}
      <Button type="primary" htmlType="submit" loading={pending}>
        {submitText}
      </Button>
    </Form>
  );
}
