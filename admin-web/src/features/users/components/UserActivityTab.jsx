import { Select } from 'antd';
import { DataTable } from '../../../components/DataTable.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { useUserActivities } from '../queries.js';

// `AdminUserActivity.type` (docs/07 §16). The docs give the values, not the texts.
const TYPE_TEXTS = { verification: '인증', report: '신고', point: '포인트', inquiry: '문의' };
const TYPE_OPTIONS = Object.entries(TYPE_TEXTS).map(([value, label]) => ({ value, label }));

const COLUMNS = [
  { title: '일시', dataIndex: 'occurredAt', render: (value) => <DateText value={value} /> },
  { title: '종류', dataIndex: 'type', render: (value) => TYPE_TEXTS[value] ?? value },
  { title: '내용', dataIndex: 'summary' },
  { title: '결과', dataIndex: 'result' },
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
        placeholder="종류"
        aria-label="종류"
        options={TYPE_OPTIONS}
        value={params.type}
        onChange={(value) => setParams({ type: value })}
      />
      <DataTable query={query} columns={COLUMNS} rowKey={rowKey} />
    </>
  );
}
