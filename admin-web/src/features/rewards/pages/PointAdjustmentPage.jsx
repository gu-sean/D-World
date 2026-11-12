// ADM-23 Manual point grant / recovery
import { Button, Form, Input, InputNumber, Radio, Typography } from 'antd';
import { Link } from 'react-router';
import { useConfirmedChange } from '../components/useConfirmedChange.jsx';
import { MAX_POINTS } from '../components/labels.js';
import { useAdjustPoints } from '../queries.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTION_TEXT = { manual_grant: '지급', manual_recovery: '회수' };

export default function PointAdjustmentPage() {
  const [form] = Form.useForm();
  const adjust = useAdjustPoints();
  const [ask, modal] = useConfirmedChange();

  // The server decides the result (balance, whether a recovery is possible); nothing is
  // calculated here (docs/parts/admin-web.md §7 rule 3).
  const onFinish = ({ userId, kind, amount }) =>
    ask({
      title: '포인트를 조정할까요?',
      summary: `회원 ${userId.trim()} · ${ACTION_TEXT[kind]} · ${amount.toLocaleString()} P`,
      danger: kind === 'manual_recovery',
      run: ({ reason, idempotencyKey }) =>
        adjust.mutateAsync({
          payload: { userId: userId.trim(), kind, amount, reason },
          idempotencyKey,
        }),
      onDone: () => form.resetFields(),
    });

  return (
    <div style={{ maxWidth: 560 }}>
      {modal}
      <Typography.Title level={3}>포인트 수동 조정</Typography.Title>
      <Typography.Paragraph type="secondary">
        수동 지급은 월 한도에 포함되지 않아요. 회수는 가용 잔액까지만 할 수 있어요.
      </Typography.Paragraph>

      <Form
        form={form}
        layout="vertical"
        initialValues={{ kind: 'manual_grant' }}
        onFinish={onFinish}
      >
        <Form.Item
          name="userId"
          label="회원 ID"
          rules={[
            { required: true, whitespace: true, message: '회원 ID를 입력해 주세요.' },
            {
              validator: (_, v) =>
                !v?.trim() || UUID.test(v.trim())
                  ? Promise.resolve()
                  : Promise.reject(new Error('회원 ID 형식을 확인해 주세요.')),
            },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="kind" label="조치">
          <Radio.Group>
            <Radio.Button value="manual_grant">지급</Radio.Button>
            <Radio.Button value="manual_recovery">회수</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item
          name="amount"
          label="포인트"
          rules={[{ required: true, message: '포인트를 입력해 주세요.' }]}
        >
          <InputNumber min={1} max={MAX_POINTS} precision={0} style={{ width: 200 }} suffix="P" />
        </Form.Item>
        <Button type="primary" htmlType="submit">
          조정하기
        </Button>{' '}
        <Link to="/rewards/points">
          <Button>내역 보기</Button>
        </Link>
      </Form>
    </div>
  );
}
