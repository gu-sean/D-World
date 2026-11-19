import { useState } from 'react';
import { Button, Tag } from 'antd';
import { DataTable } from '../../../components/DataTable.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { FilterBar } from '../../../components/FilterBar.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { RecommendationMessageForm } from '../components/RecommendationMessageForm.jsx';
import { useRecommendationMessages } from '../queries.js';
import { useConfirmedChange } from '../../../components/useConfirmedChange.jsx';
import { WEEKDAYS, weekdayLabel } from '../weekdays.js';
import { t } from '../../../i18n/index.js';
import { PageHeader } from '../../../components/PageHeader.jsx';
import { ListCard } from '../../../components/ListCard.jsx';

// 요일 필터: 1~7 = 그 요일 문구만, 비움 = 전부
const FIELDS = [
  {
    name: 'weekday',
    type: 'select',
    label: t('요일'),
    options: WEEKDAYS.map((day) => ({ value: String(day.value), label: day.label })),
  },
];

/** ADM-35 추천 문구 (M98~M100) */
export default function RecommendationMessagePage() {
  const [params, setParams] = useListParams();
  // 월~일 순으로 보여 준다
  const query = useRecommendationMessages({ sort: 'weekday,asc', ...params });
  const [ask, confirmElement] = useConfirmedChange();
  const [editing, setEditing] = useState(null); // null: closed, {}: new, {item}: edit

  const columns = [
    { title: t('문구'), dataIndex: 'message' },
    {
      title: t('요일'),
      dataIndex: 'weekday',
      width: 110,
      render: (value) => <Tag color="blue">{weekdayLabel(value)}</Tag>,
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
      <PageHeader
        title={t('추천 문구')}
        description={t('홈 화면에 요일마다 보여 줄 문구예요.')}
        actions={
          !editing && (
            <Button type="primary" onClick={() => setEditing({})}>
              {t('추천 문구 만들기')}
            </Button>
          )
        }
      />
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
      <ListCard>
        <FilterBar fields={FIELDS} value={params} onChange={setParams} />
        <DataTable query={query} columns={columns} defaultSort="weekday,asc" />
      </ListCard>
      {confirmElement}
    </>
  );
}
