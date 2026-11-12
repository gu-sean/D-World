import { Typography } from 'antd';
import { useNavigate } from 'react-router';
import { DataTable } from '../../../components/DataTable.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { FilterBar } from '../../../components/FilterBar.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { labels } from '../../../constants/labels.js';
import { useTickets } from '../queries.js';

const DEFAULT_SORT = 'receivedAt,asc'; // docs/09 M20: the oldest ticket waits the longest

const optionsOf = (kind) =>
  Object.entries(labels[kind]).map(([value, { text }]) => ({ value, label: text }));

const STATUS_FIELD = {
  name: 'status',
  type: 'select',
  label: '상태',
  options: optionsOf('ticketStatus'),
};
const ASSIGNED_FIELD = {
  name: 'assigned',
  type: 'select',
  label: '담당',
  options: [
    { value: 'me', label: '내가 담당' },
    { value: 'none', label: '담당자 없음' },
  ],
};
const TARGET_KIND_FIELD = {
  name: 'targetKind',
  type: 'select',
  label: '대상',
  options: optionsOf('ticketTargetKind'),
};

/**
 * The list of ADM-06 (inquiries) and ADM-11 (abuse reports): the same M20 query with a fixed
 * `ticketType`. A row opens the detail under `basePath`.
 * @param {object} props
 * @param {'inquiry'|'report'} props.ticketType
 * @param {string} props.basePath e.g. '/support/inquiries'
 * @param {string} props.title
 */
export function TicketList({ ticketType, basePath, title }) {
  const navigate = useNavigate();
  const isReport = ticketType === 'report';
  const [params, setParams] = useListParams({ sort: DEFAULT_SORT });
  const query = useTickets({ ...params, ticketType });

  const fields = isReport
    ? [STATUS_FIELD, ASSIGNED_FIELD, TARGET_KIND_FIELD]
    : [STATUS_FIELD, ASSIGNED_FIELD];

  const columns = [
    {
      title: '접수일',
      dataIndex: 'receivedAt',
      key: 'receivedAt',
      sorter: true,
      render: (value) => <DateText value={value} />,
    },
    { title: '분류', dataIndex: 'category' },
    { title: '제목', dataIndex: 'subject' },
    { title: '접수자', dataIndex: 'reporterNickname', render: (value) => value ?? '-' },
    ...(isReport
      ? [
          {
            title: '대상',
            key: 'target',
            render: (_, ticket) =>
              ticket.targetKind
                ? `${labels.ticketTargetKind[ticket.targetKind]?.text ?? ticket.targetKind} · ${
                    ticket.targetSummary ?? '-'
                  }`
                : '-',
          },
          {
            title: '중복 신고',
            dataIndex: 'sameTargetOpenCount',
            render: (count) => `${count}건`,
          },
        ]
      : []),
    {
      title: '상태',
      dataIndex: 'status',
      render: (value) => <StatusTag kind="ticketStatus" value={value} />,
    },
    { title: '담당', dataIndex: 'assignedAdminLoginId', render: (value) => value ?? '-' },
  ];

  return (
    <>
      <Typography.Title level={3}>{title}</Typography.Title>
      <FilterBar fields={fields} value={params} onChange={setParams} />
      <DataTable
        query={query}
        columns={columns}
        defaultSort={DEFAULT_SORT}
        onRowClick={(ticket) => navigate(`${basePath}/${ticket.id}`)}
      />
    </>
  );
}
