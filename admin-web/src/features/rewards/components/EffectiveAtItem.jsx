import { DatePicker, Form } from 'antd';
import dayjs from 'dayjs';

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
