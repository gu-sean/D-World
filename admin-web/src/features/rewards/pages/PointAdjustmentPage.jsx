// ADM-23 Manual point grant / recovery
import {
  Alert,
  Button,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Typography,
} from 'antd';
import { Link } from 'react-router';
import { ErrorAlert, ReasonItem } from '../components/formBits.jsx';
import { formatTime } from '../components/helpers.js';
import { MAX_POINTS, TRANSACTION_KINDS } from '../components/labels.js';
import { useAdjustPoints } from '../queries.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function PointAdjustmentPage() {
  const [form] = Form.useForm();
  const adjust = useAdjustPoints();
  const [modal, modalHolder] = Modal.useModal();

  const onFinish = (values) => {
    const body = {
      userId: values.userId.trim(),
      kind: values.kind,
      amount: values.amount,
      reason: values.reason.trim(),
    };
    modal.confirm({
      title: '포인트를 조정할까요?',
      content: (
        <Descriptions column={1} size="small" style={{ marginTop: 12 }}>
          <Descriptions.Item label="회원">{body.userId}</Descriptions.Item>
          <Descriptions.Item label="조치">{TRANSACTION_KINDS[body.kind]}</Descriptions.Item>
          <Descriptions.Item label="포인트">{body.amount.toLocaleString()} P</Descriptions.Item>
          <Descriptions.Item label="사유">{body.reason}</Descriptions.Item>
        </Descriptions>
      ),
      okText: '확인 후 적용',
      cancelText: '취소',
      okButtonProps: { danger: body.kind === 'manual_recovery' },
      // Rejecting keeps the dialog closed but the error is shown under the form; the input stays.
      onOk: () => adjust.mutateAsync(body).catch(() => undefined),
    });
  };

  const done = adjust.data;
  return (
    <div style={{ maxWidth: 560 }}>
      {modalHolder}
      <Typography.Title level={3}>포인트 수동 조정</Typography.Title>
      <Typography.Paragraph type="secondary">
        수동 지급은 월 한도에 포함되지 않아요. 회수는 가용 잔액까지만 할 수 있어요.
      </Typography.Paragraph>

      {done && (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message="변경 사항을 저장했습니다."
          description={`${formatTime(done.occurredAt)} · 조정 후 잔액 ${done.balanceAfter.toLocaleString()} P`}
          action={
            <Link to="/rewards/points">
              <Button size="small">내역 보기</Button>
            </Link>
          }
        />
      )}
      <ErrorAlert error={adjust.error} />

      <Form
        form={form}
        layout="vertical"
        initialValues={{ kind: 'manual_grant' }}
        onFinish={onFinish}
        onValuesChange={() => adjust.reset()}
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
          <InputNumber
            min={1}
            max={MAX_POINTS}
            precision={0}
            style={{ width: 200 }}
            addonAfter="P"
          />
        </Form.Item>
        <ReasonItem />
        <Button type="primary" htmlType="submit" loading={adjust.isPending}>
          조정하기
        </Button>
      </Form>
    </div>
  );
}
