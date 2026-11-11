import { Alert, DatePicker, Form, Input } from 'antd';
import dayjs from 'dayjs';

import { REASON_MAX } from './helpers.js';

/** Required reason field (1~500 chars, not blank: the server rule). */
export function ReasonItem({ name = 'reason', label = '사유' }) {
  return (
    <Form.Item
      name={name}
      label={label}
      rules={[
        { required: true, whitespace: true, message: '사유를 입력해 주세요.' },
        { max: REASON_MAX, message: `${REASON_MAX}자 이하로 입력해 주세요.` },
      ]}
    >
      <Input.TextArea rows={3} maxLength={REASON_MAX} showCount />
    </Form.Item>
  );
}

/** Effective time: only moments from now on. Optional means "right away" when left empty. */
export function EffectiveAtItem({ required = false }) {
  return (
    <Form.Item
      name="effectiveAt"
      label="시행 시각"
      extra={required ? undefined : '비워두면 바로 적용해요.'}
      rules={required ? [{ required: true, message: '시행 시각을 선택해 주세요.' }] : []}
    >
      <DatePicker
        showTime
        format="YYYY-MM-DD HH:mm"
        disabledDate={(date) => date.isBefore(dayjs(), 'day')}
      />
    </Form.Item>
  );
}

/** Shows the AdminError of a failed mutation under the form. */
export function ErrorAlert({ error }) {
  if (!error) return null;
  return <Alert type="error" showIcon message={error.message} style={{ marginBottom: 16 }} />;
}
