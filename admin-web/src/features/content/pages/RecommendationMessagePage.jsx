import { useState } from 'react';
import { Button, Space, Tag, Typography } from 'antd';
import { DataTable } from '../../../components/DataTable.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { FilterBar } from '../../../components/FilterBar.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { RecommendationMessageForm } from '../components/RecommendationMessageForm.jsx';
import { useRecommendationMessages } from '../queries.js';
import { useConfirm } from '../useConfirm.jsx';
import { WEEKDAYS, weekdayLabel } from '../weekdays.js';
import { t } from '../../../i18n/index.js';

// 요일 필터: all = 매일 문구만, 1~7 = 그 요일 문구만, 비움 = 전부
const FIELDS = [
  {
    name: 'weekday',
    type: 'select',
    label: t('요일'),
    options: [
      { value: 'all', label: t('매일') },
      ...WEEKDAYS.map((day) => ({ value: String(day.value), label: day.label })),
    ],
  },
];

/** ADM-35 추천 문구 (M98~M100) */
export default function RecommendationMessagePage() {
  const [params, setParams] = useListParams();
  // 매일 문구 → 월~일 순으로 보여 준다
  const query = useRecommendationMessages({ sort: 'weekday,asc', ...params });
  const [confirmElement, ask] = useConfirm();
  const [editing, setEditing] = useState(null); // null: closed, {}: new, {item}: edit

  const columns = [
    { title: t('문구'), dataIndex: 'message' },
    {
      title: t('요일'),
      dataIndex: 'weekday',
      width: 110,
      render: (value) => (
        <Tag color={value == null ? 'default' : 'blue'}>{weekdayLabel(value)}</Tag>
      ),
    },
    { title: t('분야'), dataIndex: 'categoryCode', render: (value) => value ?? '-' },
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
      <FilterBar fields={FIELDS} value={params} onChange={setParams} />
      <DataTable query={query} columns={columns} defaultSort="weekday,asc" />
      {confirmElement}
    </>
  );
}
