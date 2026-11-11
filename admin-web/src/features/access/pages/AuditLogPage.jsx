import { useState } from 'react';
import { Button, Tag, Typography } from 'antd';
import { Link } from 'react-router';
import { DataTable } from '../../../components/DataTable.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { FilterBar } from '../../../components/FilterBar.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { AuditLogDetailModal } from '../components/AuditLogDetailModal.jsx';
import { auditResult } from '../labels.js';
import { useAuditLogs } from '../queries.js';

const DEFAULT_SORT = 'recordedAt,desc'; // docs/09 M101

const FIELDS = [
  { name: 'adminId', type: 'text', label: '관리자' },
  { name: 'action', type: 'text', label: '작업 (앞부분, 예: verification.)' },
  { name: 'targetUserId', type: 'text', label: '대상 회원 ID' },
  {
    name: 'result',
    type: 'select',
    label: '결과',
    options: Object.entries(auditResult).map(([value, { text }]) => ({ value, label: text })),
  },
  { name: 'period', type: 'dateRange', label: '기간' },
];

/** ADM-36 감사 로그 (M101): every change of the other menus, with its before and after values. */
export default function AuditLogPage() {
  const [params, setParams] = useListParams({ sort: DEFAULT_SORT });
  const query = useAuditLogs(params);
  const [viewing, setViewing] = useState(null);

  const columns = [
    {
      title: '기록 시각',
      dataIndex: 'recordedAt',
      key: 'recordedAt',
      sorter: true,
      render: (value) => <DateText value={value} format="YYYY-MM-DD HH:mm:ss" />,
    },
    { title: '관리자', dataIndex: 'adminLoginId' },
    { title: '작업', dataIndex: 'action' },
    {
      title: '대상 회원',
      dataIndex: 'targetUserId',
      render: (id) => (id ? <Link to={`/users/${id}`}>{id.slice(0, 8)}</Link> : '-'),
    },
    {
      title: '결과',
      dataIndex: 'result',
      render: (value) => (
        <Tag color={auditResult[value]?.color}>{auditResult[value]?.text ?? value}</Tag>
      ),
    },
    { title: '사유', dataIndex: 'reason', render: (value) => value ?? '-' },
    {
      title: '',
      key: 'detail',
      render: (_, log) => (
        <Button size="small" onClick={() => setViewing(log)}>
          변경 내용
        </Button>
      ),
    },
  ];

  return (
    <>
      <Typography.Title level={3}>감사 로그</Typography.Title>
      <FilterBar fields={FIELDS} value={params} onChange={setParams} />
      <DataTable query={query} columns={columns} defaultSort={DEFAULT_SORT} />
      <AuditLogDetailModal log={viewing} onClose={() => setViewing(null)} />
    </>
  );
}
