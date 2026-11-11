import { useState } from 'react';
import { Input, Typography } from 'antd';

const REASON_MAX = 500;

export default function ReasonField({ holder, description }) {
  const [error, setError] = useState('');
  holder.setError = setError;
  return (
    <div>
      {description && <Typography.Paragraph>{description}</Typography.Paragraph>}
      <Input.TextArea
        rows={3}
        maxLength={REASON_MAX}
        showCount
        placeholder="사유를 입력해 주세요. (필수)"
        status={error ? 'error' : undefined}
        onChange={(event) => {
          holder.value = event.target.value;
          setError('');
        }}
      />
      {error && <Typography.Text type="danger">{error}</Typography.Text>}
    </div>
  );
}
