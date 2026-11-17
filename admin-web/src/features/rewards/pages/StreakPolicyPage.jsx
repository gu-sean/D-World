// ADM-27 Streak milestone rewards
import { Button, Form, InputNumber, Select, Table, Tag, Typography } from 'antd';
import { DateText } from '../../../components/DateText.jsx';
import { QueryBoundary } from '../../../components/QueryBoundary.jsx';
import { EffectiveAtItem } from '../components/EffectiveAtItem.jsx';
import { pickCurrent, toIso } from '../components/helpers.js';
import { MAX_POINTS, STREAK_TARGET_DAYS } from '../components/labels.js';
import { useConfirmedChange } from '../components/useConfirmedChange.jsx';
import { useCreateStreakMilestone, useStreakMilestones } from '../queries.js';
import { t } from '../../../i18n/index.js';

const numberItem = (name, label) => (
  <Form.Item
    name={name}
    label={label}
    rules={[{ required: true, message: t('{0}를 입력해 주세요.', label) }]}
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
      title: t('새 버전을 저장할까요?'),
      summary: t(
        '연속 {0}일 · {1}P / 펫 {2}XP',
        values.targetSuccessDays,
        values.points,
        values.petXp,
      ),
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
      <Typography.Title level={3}>{t('연속 일수 정책')}</Typography.Title>
      <Typography.Paragraph type="secondary">
        {t('정책은 수정하지 않고 새 버전을 추가해요. 이전 버전은 이력으로 남아요.')}
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
                  title: t('연속 성공 일수'),
                  dataIndex: 'targetSuccessDays',
                  render: (d) => t('{0}일', d),
                },
                { title: t('버전'), dataIndex: 'versionNo', render: (v) => `v${v}` },
                { title: t('포인트'), dataIndex: 'points', align: 'right' },
                { title: t('펫 XP'), dataIndex: 'petXp', align: 'right' },
                {
                  title: t('시행 시각'),
                  dataIndex: 'effectiveAt',
                  render: (value) => <DateText value={value} />,
                },
                {
                  title: t('상태'),
                  render: (_, row) =>
                    currentIds.has(row.id) ? (
                      <Tag color="green">{t('적용 중')}</Tag>
                    ) : (
                      <Tag>{t('이력')}</Tag>
                    ),
                },
              ]}
            />
          );
        }}
      </QueryBoundary>

      <Typography.Title level={4} style={{ marginTop: 32 }}>
        {t('새 버전 추가')}
      </Typography.Title>
      <Form form={form} layout="vertical" style={{ maxWidth: 480 }} onFinish={onFinish}>
        <Form.Item
          name="targetSuccessDays"
          label={t('연속 성공 일수')}
          rules={[{ required: true, message: t('일수를 선택해 주세요.') }]}
        >
          <Select
            options={STREAK_TARGET_DAYS.map((d) => ({ value: d, label: t('{0}일', d) }))}
            style={{ width: 160 }}
          />
        </Form.Item>
        {numberItem('points', t('포인트'))}
        {numberItem('petXp', t('펫 XP'))}
        <EffectiveAtItem />
        <Button type="primary" htmlType="submit">
          {t('새 버전 저장')}
        </Button>
      </Form>
    </div>
  );
}
