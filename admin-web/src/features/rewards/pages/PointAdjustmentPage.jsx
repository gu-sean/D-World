// ADM-23 Manual point grant / recovery
import { Alert, Button, Form, Input, InputNumber, Radio, Typography } from 'antd';
import { Link, useSearchParams } from 'react-router';
import { useConfirmedChange } from '../components/useConfirmedChange.jsx';
import { MAX_POINTS } from '../components/labels.js';
import { useAdjustPoints, useMember } from '../queries.js';
import { ID_PATTERN } from '../../../api/ids.js';

const ACTION_TEXT = { manual_grant: '지급', manual_recovery: '회수' };

/** 입력한 회원 ID가 누구인지 바로 아래에 보여 준다 (잘못된 회원에게 조정하지 않게). */
function MemberCheck({ query }) {
  if (!query.data && !query.isError) return null;
  if (query.isError) {
    return <Alert type="error" showIcon message="이 회원 ID로 가입한 회원을 찾을 수 없어요." />;
  }
  const user = query.data;
  return (
    <Alert
      type="info"
      showIcon
      message={`${user.nickname ?? '(닉네임 없음)'} · 보유 ${user.availablePoints.toLocaleString()} P`}
    />
  );
}

export default function PointAdjustmentPage() {
  const [form] = Form.useForm();
  const [searchParams] = useSearchParams();
  const adjust = useAdjustPoints();
  const [ask, modal] = useConfirmedChange();

  // 회원 상세의 "포인트 조정"에서 오면 회원 ID가 채워져 있다 (?userId=)
  const typedId = (Form.useWatch('userId', form) ?? '').trim();
  const member = useMember(ID_PATTERN.test(typedId) ? typedId : null);

  // The server decides the result (balance, whether a recovery is possible); nothing is
  // calculated here (docs/parts/admin-web.md §7 rule 3).
  const onFinish = ({ userId, kind, amount }) =>
    ask({
      title: '포인트를 조정할까요?',
      summary: `${member.data?.nickname ?? '회원'} (${userId.trim()}) · ${ACTION_TEXT[kind]} · ${amount.toLocaleString()} P`,
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
        initialValues={{ kind: 'manual_grant', userId: searchParams.get('userId') ?? undefined }}
        onFinish={onFinish}
      >
        <Form.Item
          name="userId"
          label="회원 ID"
          extra="회원 목록이나 회원 상세에서 회원 ID 옆 복사 버튼으로 복사해 붙여 넣어요."
          rules={[
            { required: true, whitespace: true, message: '회원 ID를 입력해 주세요.' },
            {
              validator: (_, v) =>
                !v?.trim() || ID_PATTERN.test(v.trim())
                  ? Promise.resolve()
                  : Promise.reject(new Error('회원 ID 형식을 확인해 주세요.')),
            },
          ]}
        >
          {/* 회원 ID 8자를 알아보기 쉽게 고정폭 글꼴로 */}
          <Input style={{ fontFamily: 'monospace' }} maxLength={8} />
        </Form.Item>
        <div style={{ marginTop: -8, marginBottom: 16 }}>
          <MemberCheck query={member} />
        </div>
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
        <Button type="primary" htmlType="submit" disabled={member.isError}>
          조정하기
        </Button>{' '}
        <Link to={typedId ? `/rewards/points?member=${typedId}` : '/rewards/points'}>
          <Button>내역 보기</Button>
        </Link>
      </Form>
    </div>
  );
}
