// ADM-17 Featured (recommended) missions
// ASSUMPTION: the featured-missions API is a proposal (see api.js); no backend endpoint yet.
import { useState } from 'react';
import { Alert, Button, Select, Space, Table, Typography, message } from 'antd';
import StatePanel from '../../../components/StatePanel.jsx';
import confirmWithReason from '../confirmWithReason.jsx';
import { useAddFeatured, useDefinitions, useFeatured, useRemoveFeatured } from '../queries.js';

export default function FeaturedMissionPage() {
  const { data, isLoading, error, refetch } = useFeatured();
  const { data: publicDefinitions } = useDefinitions({
    publicationStatus: 'public',
    size: 100,
  });
  const add = useAddFeatured();
  const remove = useRemoveFeatured();
  const [selected, setSelected] = useState();

  const items = data?.items ?? [];
  const candidates = (publicDefinitions?.items ?? []).filter(
    (definition) => !items.some((item) => item.definitionId === definition.id),
  );

  const addSelected = () =>
    confirmWithReason({
      title: '추천 미션으로 선정할까요?',
      okText: '선정',
      onOk: async (reason, idempotencyKey) => {
        await add.mutateAsync({ body: { definitionId: selected, reason }, idempotencyKey });
        setSelected(undefined);
        message.success('변경 사항을 저장했습니다.');
      },
    });
  const removeItem = (row) =>
    confirmWithReason({
      title: `${row.title}: 추천을 해제할까요?`,
      okText: '해제',
      danger: true,
      onOk: async (reason, idempotencyKey) => {
        await remove.mutateAsync({ id: row.id, body: { reason }, idempotencyKey });
        message.success('변경 사항을 저장했습니다.');
      },
    });

  return (
    <div>
      <Typography.Title level={4}>추천 미션</Typography.Title>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="공개 상태인 미션만 추천으로 선정할 수 있어요."
      />
      <Space style={{ marginBottom: 16 }}>
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="공개 미션 선택"
          style={{ width: 320 }}
          value={selected}
          onChange={setSelected}
          options={candidates.map((definition) => ({
            value: definition.id,
            label: definition.title,
          }))}
        />
        <Button type="primary" disabled={!selected} onClick={addSelected}>
          추천으로 선정
        </Button>
      </Space>
      <StatePanel
        loading={isLoading}
        error={error}
        onRetry={refetch}
        empty={items.length === 0}
        emptyText="추천 미션이 없습니다."
      >
        <Table
          rowKey="id"
          pagination={false}
          dataSource={items}
          columns={[
            { title: '순서', dataIndex: 'displayOrder', width: 80 },
            { title: '미션', dataIndex: 'title' },
            {
              title: '',
              width: 100,
              render: (_, row) => (
                <Button size="small" danger onClick={() => removeItem(row)}>
                  해제
                </Button>
              ),
            },
          ]}
        />
      </StatePanel>
    </div>
  );
}
