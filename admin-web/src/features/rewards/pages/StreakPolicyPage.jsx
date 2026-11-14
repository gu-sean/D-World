// ADM-27 Streak milestone rewards
import { Button, Form, InputNumber, Select, Table, Tag, Typography } from 'antd';
import { DateText } from '../../../components/DateText.jsx';
import { QueryBoundary } from '../../../components/QueryBoundary.jsx';
import { EffectiveAtItem } from '../components/EffectiveAtItem.jsx';
import { pickCurrent, toIso } from '../components/helpers.js';
import { MAX_POINTS, STREAK_TARGET_DAYS } from '../components/labels.js';
import { useConfirmedChange } from '../components/useConfirmedChange.jsx';
import { useCreateStreakMilestone, useStreakMilestones } from '../queries.js';

const numberItem = (name, label) => (
  <Form.Item
    name={name}
    label={label}
    rules={[{ required: true, message: `${label}를 입력해 주세요.` }]}
  >
    <InputNumber min={0} max={MAX_POINTS} precision={0} />
  </Form.Item>
);

export default function StreakPolicyPage() {
  const [form] = Form.useForm();
  const list = useStreakMilestones();
  const create = useCreateStreakMilestone();
  const [ask, modal] = useConfirmedChange();

  const onFinish = ({ effectiveAt, ...values }) =>
    ask({
      title: '새 버전을 저장할까요?',
      summary: `연속 ${values.targetSuccessDays}일 · ${values.points}P / 펫 ${values.petXp}XP`,
      run: ({ reason, idempotencyKey }) =>
        create.mutateAsync({
          payload: { ...values, effectiveAt: toIso(effectiveAt), reason },
          idempotencyKey,
        }),
      onDone: () => form.resetFields(),
    });

  return (
    <div>
      {modal}
      <Typography.Title level={3}>연속 일수 정책</Typography.Title>
      <Typography.Paragraph type="secondary">
        정책은 수정하지 않고 새 버전을 추가해요. 이전 버전은 이력으로 남아요.
      </Typography.Paragraph>

      <QueryBoundary query={list}>
        {({ items }) => {
          const currentIds = new Set(
            STREAK_TARGET_DAYS.map(
              (days) => pickCurrent(items.filter((item) => item.targetSuccessDays === days))?.id,
            ).filter(Boolean),
          );
          return (
            <Table
              rowKey="id"
              dataSource={items}
              pagination={false}
              columns={[
                {
                  title: '연속 성공 일수',
                  dataIndex: 'targetSuccessDays',
                  render: (d) => `${d}일`,
                },
                { title: '버전', dataIndex: 'versionNo', render: (v) => `v${v}` },
                { title: '포인트', dataIndex: 'points', align: 'right' },
                { title: '펫 XP', dataIndex: 'petXp', align: 'right' },
                {
                  title: '시행 시각',
                  dataIndex: 'effectiveAt',
                  render: (value) => <DateText value={value} />,
                },
                {
                  title: '상태',
                  render: (_, row) =>
                    currentIds.has(row.id) ? <Tag color="green">적용 중</Tag> : <Tag>이력</Tag>,
                },
              ]}
            />
          );
        }}
      </QueryBoundary>

      <Typography.Title level={4} style={{ marginTop: 32 }}>
        새 버전 추가
      </Typography.Title>
      <Form form={form} layout="vertical" style={{ maxWidth: 480 }} onFinish={onFinish}>
        <Form.Item
          name="targetSuccessDays"
          label="연속 성공 일수"
          rules={[{ required: true, message: '일수를 선택해 주세요.' }]}
        >
          <Select
            options={STREAK_TARGET_DAYS.map((d) => ({ value: d, label: `${d}일` }))}
            style={{ width: 160 }}
          />
        </Form.Item>
        {numberItem('points', '포인트')}
        {numberItem('petXp', '펫 XP')}
        <EffectiveAtItem />
        <Button type="primary" htmlType="submit">
          새 버전 저장
        </Button>
      </Form>
    </div>
  );
}
