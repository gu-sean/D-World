import { Select } from 'antd';
import { DataTable } from '../../../components/DataTable.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { useUserActivities } from '../queries.js';
import { t } from '../../../i18n/index.js';

// `AdminUserActivity.type` (docs/07 §16). The docs give the values, not the texts.
const TYPE_TEXTS = {
  verification: t('인증'),
  report: t('신고'),
  point: t('포인트'),
  inquiry: t('문의'),
};
const TYPE_OPTIONS = Object.entries(TYPE_TEXTS).map(([value, label]) => ({ value, label }));

const COLUMNS = [
  { title: t('일시'), dataIndex: 'occurredAt', render: (value) => <DateText value={value} /> },
  { title: t('종류'), dataIndex: 'type', render: (value) => TYPE_TEXTS[value] ?? value },
  { title: t('내용'), dataIndex: 'summary' },
  { title: t('결과'), dataIndex: 'result' },
];

const rowKey = (row) => `${row.type}:${row.targetId}:${row.occurredAt}`;

/** The activity tab of ADM-03 (M12): newest first, filtered by type. */
export function UserActivityTab({ userId }) {
  const [params, setParams] = useListParams();
  const query = useUserActivities(userId, {
    type: params.type,
    page: params.page,
    size: params.size,
  });

  return (
    <>
      <Select
        allowClear
        style={{ width: 160, marginBottom: 16 }}
        placeholder={t('종류')}
        aria-label={t('종류')}
        options={TYPE_OPTIONS}
        value={params.type}
        onChange={(value) => setParams({ type: value })}
      />
      <DataTable query={query} columns={COLUMNS} rowKey={rowKey} />
    </>
  );
}
