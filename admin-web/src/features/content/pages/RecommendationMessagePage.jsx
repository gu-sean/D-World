import { useState } from 'react';
import { Button, Space, Tag, Typography } from 'antd';
import { DataTable } from '../../../components/DataTable.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { RecommendationMessageForm } from '../components/RecommendationMessageForm.jsx';
import { useRecommendationMessages } from '../queries.js';
import { useConfirm } from '../useConfirm.jsx';

// "6~9시" or "3일" next to the name of the condition.
function paramsText(item) {
  const { conditionType, conditionParams: params } = item;
  if (conditionType === 'inactive_days') return `${params.days}일`;
  if (conditionType === 'time_slot') return `${params.startHour}~${params.endHour}시`;
  return null;
}

/** ADM-35 추천 문구 (M98~M100) */
export default function RecommendationMessagePage() {
  const [params] = useListParams();
  const query = useRecommendationMessages(params);
  const [confirmElement, ask] = useConfirm();
  const [editing, setEditing] = useState(null); // null: closed, {}: new, {item}: edit

  const columns = [
    { title: '문구', dataIndex: 'message' },
    {
      title: '조건',
      key: 'condition',
      render: (_, item) => (
        <Space>
          <StatusTag kind="recommendationConditionType" value={item.conditionType} />
          {paramsText(item)}
        </Space>
      ),
    },
    { title: '분야', dataIndex: 'categoryCode', render: (value) => value ?? '-' },
    { title: '우선순위', dataIndex: 'priority' },
    {
      title: '기간',
      key: 'period',
      render: (_, item) =>
        item.startsAt || item.endsAt ? (
          <>
            <DateText value={item.startsAt} /> ~ <DateText value={item.endsAt} />
          </>
        ) : (
          '항상'
        ),
    },
    {
      title: '사용',
      dataIndex: 'isActive',
      render: (value) => (value ? <Tag color="success">사용</Tag> : <Tag>중지</Tag>),
    },
    {
      title: '',
      key: 'actions',
      render: (_, item) => (
        <Button size="small" onClick={() => setEditing({ item })}>
          수정
        </Button>
      ),
    },
  ];

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={3}>추천 문구</Typography.Title>
        {!editing && (
          <Button type="primary" onClick={() => setEditing({})}>
            추천 문구 만들기
          </Button>
        )}
      </Space>
      {editing && (
        <div style={{ marginBottom: 24 }}>
          <RecommendationMessageForm
            key={editing.item?.id ?? 'new'}
            item={editing.item}
            onConfirm={ask}
            onClose={() => setEditing(null)}
          />
        </div>
      )}
      <DataTable query={query} columns={columns} />
      {confirmElement}
    </>
  );
}
