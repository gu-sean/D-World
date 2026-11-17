// ADM-24 Point policies: monthly cap and mission reward table
import { useState } from 'react';
import { Button, DatePicker, Form, InputNumber, Select, Table, Tabs, Typography } from 'antd';
import { DateText } from '../../../components/DateText.jsx';
import { QueryBoundary } from '../../../components/QueryBoundary.jsx';
import { StatePanel } from '../../../components/StatePanel.jsx';
import { EffectiveAtItem } from '../components/EffectiveAtItem.jsx';
import { toIso } from '../components/helpers.js';
import { MAX_POINTS } from '../components/labels.js';
import { useConfirmedChange } from '../components/useConfirmedChange.jsx';
import {
  useCategories,
  useCreatePointCap,
  useCreateRewardRate,
  useDifficultyLevels,
  usePointCaps,
  useRewardRates,
} from '../queries.js';
import { t } from '../../../i18n/index.js';

function MonthlyCapTab() {
  const [form] = Form.useForm();
  const list = usePointCaps();
  const create = useCreatePointCap();
  const [ask, modal] = useConfirmedChange();

  const onFinish = ({ month, monthlyLimitPoints }) =>
    ask({
      title: t('새 월 한도를 저장할까요?'),
      summary: `${month.format('YYYY-MM')} · ${monthlyLimitPoints.toLocaleString()} P`,
      run: ({ reason, idempotencyKey }) =>
        create.mutateAsync({
          payload: { effectiveMonth: month.format('YYYY-MM-01'), monthlyLimitPoints, reason },
          idempotencyKey,
        }),
      onDone: () => form.resetFields(),
    });

  return (
    <>
      {modal}
      <QueryBoundary query={list}>
        {({ items }) =>
          items.length === 0 ? (
            <StatePanel type="empty" />
          ) : (
            <Table
              rowKey="id"
              pagination={false}
              dataSource={items}
              columns={[
                { title: t('적용 월'), dataIndex: 'effectiveMonth', render: (m) => m?.slice(0, 7) },
                {
                  title: t('월 한도'),
                  dataIndex: 'monthlyLimitPoints',
                  align: 'right',
                  render: (n) => `${n.toLocaleString()} P`,
                },
              ]}
            />
          )
        }
      </QueryBoundary>
      <Typography.Title level={5} style={{ marginTop: 24 }}>
        {t('새 월 한도 추가')}
      </Typography.Title>
      <Form form={form} layout="vertical" style={{ maxWidth: 420 }} onFinish={onFinish}>
        <Form.Item
          name="month"
          label={t('적용 월')}
          rules={[{ required: true, message: t('적용 월을 선택해 주세요.') }]}
        >
          <DatePicker picker="month" />
        </Form.Item>
        <Form.Item
          name="monthlyLimitPoints"
          label={t('월 한도')}
          rules={[{ required: true, message: t('월 한도를 입력해 주세요.') }]}
        >
          <InputNumber min={0} max={MAX_POINTS} precision={0} suffix="P" />
        </Form.Item>
        <Button type="primary" htmlType="submit">
          {t('저장')}
        </Button>
      </Form>
    </>
  );
}

function RewardRateTab() {
  const [form] = Form.useForm();
  const [filter, setFilter] = useState({});
  const categories = useCategories();
  const difficulties = useDifficultyLevels();
  const list = useRewardRates(filter);
  const create = useCreateRewardRate();
  const [ask, modal] = useConfirmedChange();

  const nameOf = (rows, id) => rows?.find((row) => row.id === id)?.name ?? id;
  const toOptions = (rows) => (rows ?? []).map((row) => ({ value: row.id, label: row.name }));

  const onFinish = ({ effectiveAt, ...values }) =>
    ask({
      title: t('새 보상표 버전을 저장할까요?'),
      summary: t(
        '{0} · {1} · {2}P / 펫 {3}XP',
        nameOf(categories.data, values.categoryId),
        nameOf(difficulties.data, values.difficultyId),
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

  const numberItem = (name, label) => (
    <Form.Item
      name={name}
      label={label}
      rules={[{ required: true, message: t('{0}를 입력해 주세요.', label) }]}
    >
      <InputNumber min={0} max={MAX_POINTS} precision={0} />
    </Form.Item>
  );

  return (
    <>
      {modal}
      <Form
        layout="inline"
        style={{ marginBottom: 16 }}
        onValuesChange={(_, all) =>
          setFilter({ categoryId: all.categoryId, difficultyId: all.difficultyId })
        }
      >
        <Form.Item name="categoryId">
          <Select
            allowClear
            placeholder={t('분야')}
            options={toOptions(categories.data)}
            style={{ width: 160 }}
          />
        </Form.Item>
        <Form.Item name="difficultyId">
          <Select
            allowClear
            placeholder={t('난이도')}
            options={toOptions(difficulties.data)}
            style={{ width: 160 }}
          />
        </Form.Item>
      </Form>
      <QueryBoundary query={list}>
        {(items) =>
          items.length === 0 ? (
            <StatePanel type="empty" />
          ) : (
            <Table
              rowKey="id"
              pagination={false}
              dataSource={items}
              columns={[
                {
                  title: t('분야'),
                  dataIndex: 'categoryId',
                  render: (id) => nameOf(categories.data, id),
                },
                {
                  title: t('난이도'),
                  dataIndex: 'difficultyId',
                  render: (id) => nameOf(difficulties.data, id),
                },
                { title: t('버전'), dataIndex: 'versionNo', render: (v) => `v${v}` },
                { title: t('포인트'), dataIndex: 'points', align: 'right' },
                { title: t('펫 XP'), dataIndex: 'petXp', align: 'right' },
                {
                  title: t('시행 시각'),
                  dataIndex: 'effectiveAt',
                  render: (value) => <DateText value={value} />,
                },
              ]}
            />
          )
        }
      </QueryBoundary>
      <Typography.Title level={5} style={{ marginTop: 24 }}>
        {t('새 보상표 버전 추가')}
      </Typography.Title>
      <Form form={form} layout="vertical" style={{ maxWidth: 420 }} onFinish={onFinish}>
        <Form.Item
          name="categoryId"
          label={t('분야')}
          rules={[{ required: true, message: t('분야를 선택해 주세요.') }]}
        >
          <Select options={toOptions(categories.data)} />
        </Form.Item>
        <Form.Item
          name="difficultyId"
          label={t('난이도')}
          rules={[{ required: true, message: t('난이도를 선택해 주세요.') }]}
        >
          <Select options={toOptions(difficulties.data)} />
        </Form.Item>
        {numberItem('points', t('포인트'))}
        {numberItem('petXp', t('펫 XP'))}
        <EffectiveAtItem />
        <Button type="primary" htmlType="submit" loading={create.isPending}>
          {t('새 버전 저장')}
        </Button>
      </Form>
    </>
  );
}

export default function PointPolicyPage() {
  return (
    <div>
      <Typography.Title level={3}>{t('포인트 정책')}</Typography.Title>
      <Typography.Paragraph type="secondary">
        {t('정책은 수정하지 않고 새 버전을 추가해요. 이전 버전은 이력으로 남아요.')}
      </Typography.Paragraph>
      <Tabs
        items={[
          { key: 'cap', label: t('월간 한도'), children: <MonthlyCapTab /> },
          { key: 'rates', label: t('미션 보상표'), children: <RewardRateTab /> },
        ]}
      />
    </div>
  );
}
