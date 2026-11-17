import { useState } from 'react';
import { Button, Space, Tag, Typography } from 'antd';
import { DataTable } from '../../../components/DataTable.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { RecommendationMessageForm } from '../components/RecommendationMessageForm.jsx';
import { useRecommendationMessages } from '../queries.js';
import { useConfirm } from '../useConfirm.jsx';
import { t } from '../../../i18n/index.js';

// "6~9시" or "3일" next to the name of the condition.
function paramsText(item) {
  const { conditionType, conditionParams: params } = item;
  if (conditionType === 'inactive_days') return t('{0}일', params.days);
  if (conditionType === 'time_slot') return t('{0}~{1}시', params.startHour, params.endHour);
  return null;
}

/** ADM-35 추천 문구 (M98~M100) */
export default function RecommendationMessagePage() {
  const [params] = useListParams();
  const query = useRecommendationMessages(params);
  const [confirmElement, ask] = useConfirm();
  const [editing, setEditing] = useState(null); // null: closed, {}: new, {item}: edit

  const columns = [
    { title: t('문구'), dataIndex: 'message' },
    {
      title: t('조건'),
      key: 'condition',
      render: (_, item) => (
        <Space>
          <StatusTag kind="recommendationConditionType" value={item.conditionType} />
          {paramsText(item)}
        </Space>
      ),
    },
    { title: t('분야'), dataIndex: 'categoryCode', render: (value) => value ?? '-' },
    { title: t('우선순위'), dataIndex: 'priority' },
    {
      title: t('기간'),
      key: 'period',
      render: (_, item) =>
        item.startsAt || item.endsAt ? (
          <>
            <DateText value={item.startsAt} /> ~ <DateText value={item.endsAt} />
          </>
        ) : (
          t('항상')
        ),
    },
    {
      title: t('사용'),
      dataIndex: 'isActive',
      render: (value) => (value ? <Tag color="success">{t('사용')}</Tag> : <Tag>{t('중지')}</Tag>),
    },
    {
      title: '',
      key: 'actions',
      render: (_, item) => (
        <Button size="small" onClick={() => setEditing({ item })}>
          {t('수정')}
        </Button>
      ),
    },
  ];

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={3}>{t('추천 문구')}</Typography.Title>
        {!editing && (
          <Button type="primary" onClick={() => setEditing({})}>
            {t('추천 문구 만들기')}
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
