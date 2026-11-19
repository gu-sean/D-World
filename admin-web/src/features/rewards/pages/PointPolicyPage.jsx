// ADM-24 Point policies: daily limit (read-only, app rules) and mission reward table
import { useState } from 'react';
import { Button, Form, InputNumber, Select, Table, Tabs, Typography } from 'antd';
import { DateText } from '../../../components/DateText.jsx';
import { QueryBoundary } from '../../../components/QueryBoundary.jsx';
import { StatePanel } from '../../../components/StatePanel.jsx';
import { EffectiveAtItem } from '../components/EffectiveAtItem.jsx';
import { DailyLimitRules } from '../components/GameRulesCards.jsx';
import { GAME_RULES } from '../components/gameRules.js';
import { toIso } from '../components/helpers.js';
import { MAX_POINTS } from '../components/labels.js';
import { useConfirmedChange } from '../../../components/useConfirmedChange.jsx';
import {
  useCategories,
  useCreateRewardRate,
  useDifficultyLevels,
  useRewardRates,
} from '../queries.js';
import { t } from '../../../i18n/index.js';
import { PageHeader } from '../../../components/PageHeader.jsx';

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
        name="rateFilter"
        layout="inline"
        className="mb-16"
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
      <Typography.Paragraph type="secondary">
        {t(
          '앱 기준: 모든 분야·난이도의 세부 미션 1회는 {0} P · 펫 XP {1}이에요(하루 포인트 한도 {2} P). 새 버전은 이후에 만드는 미션부터 적용돼요.',
          GAME_RULES.missionPoints,
          GAME_RULES.missionPetXp,
          GAME_RULES.dailyPointLimit,
        )}
      </Typography.Paragraph>
      <QueryBoundary query={list}>
        {(items) => {
          if (items.length === 0) return <StatePanel type="empty" />;
          // 시행 시각 내림차순: 분야·난이도마다 이미 시행된 첫 버전이 '현재 적용 중'.
          // 이미 대체된 이전 버전은 보여 주지 않고, 아직 시행 전인 '예정' 버전만 따로 보여 준다.
          const now = Date.now();
          const seen = new Set();
          const current = [];
          const upcoming = [];
          for (const row of items) {
            const key = `${row.categoryId}:${row.difficultyId}`;
            if (new Date(row.effectiveAt).getTime() > now) {
              upcoming.push(row);
            } else if (!seen.has(key)) {
              seen.add(key);
              current.push(row);
            }
          }
          const columns = [
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
          ];
          return (
            <>
              <Typography.Title level={5}>{t('현재 적용 중')}</Typography.Title>
              <Table rowKey="id" pagination={false} dataSource={current} columns={columns} />
              {upcoming.length > 0 && (
                <>
                  <Typography.Title level={5} style={{ marginTop: 24 }}>
                    {t('예정 버전')}
                  </Typography.Title>
                  <Table rowKey="id" pagination={false} dataSource={upcoming} columns={columns} />
                </>
              )}
            </>
          );
        }}
      </QueryBoundary>
      <Typography.Title level={5} style={{ marginTop: 24 }}>
        {t('새 보상표 버전 추가')}
      </Typography.Title>
      <Form
        name="rateCreate"
        form={form}
        layout="vertical"
        style={{ maxWidth: 420 }}
        onFinish={onFinish}
      >
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
      <PageHeader title={t('포인트 정책')} />
      <Typography.Paragraph type="secondary">
        {t('정책은 수정하지 않고 새 버전을 추가해요. 이전 버전은 이력으로 남아요.')}
      </Typography.Paragraph>
      <Tabs
        items={[
          { key: 'daily', label: t('하루 한도'), children: <DailyLimitRules /> },
          { key: 'rates', label: t('미션 보상표'), children: <RewardRateTab /> },
        ]}
      />
    </div>
  );
}
