import { Tag, Typography } from 'antd';
import { useNavigate } from 'react-router';
import { DataTable } from '../../../components/DataTable.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { FilterBar } from '../../../components/FilterBar.jsx';
import { MaskedText } from '../../../components/MaskedText.jsx';
import { memberColumn } from '../../../components/memberColumns.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { labels } from '../../../constants/labels.js';
import { useUsers } from '../queries.js';

const DEFAULT_SORT = 'createdAt,desc'; // docs/09 M10

const FIELDS = [
  // M10은 `query`를 받는다 (다른 목록의 MEMBER_FIELD와 같은 규칙)
  { name: 'query', type: 'text', label: '닉네임 또는 회원 ID', width: 320 },
  {
    name: 'status',
    type: 'select',
    label: '상태',
    options: Object.entries(labels.userStatus).map(([value, { text }]) => ({ value, label: text })),
  },
  {
    name: 'restricted',
    type: 'select',
    label: '이용 제한',
    options: [
      { value: 'true', label: '제한 중' },
      { value: 'false', label: '제한 없음' },
    ],
  },
  { name: 'joined', type: 'dateRange' }, // FilterBar writes `from`/`to`; M10 wants joinedFrom/joinedTo
];

const COLUMNS = [
  memberColumn({ idKey: 'id', nicknameKey: 'nickname' }),
  {
    title: '휴대폰',
    dataIndex: 'maskedPhoneNumber',
    render: (value) => <MaskedText value={value} />,
  },
  { title: '이메일', dataIndex: 'maskedEmail', render: (value) => <MaskedText value={value} /> },
  {
    title: '상태',
    dataIndex: 'status',
    render: (value) => <StatusTag kind="userStatus" value={value} />,
  },
  {
    title: '이용 제한',
    dataIndex: 'restriction',
    render: (value) =>
      value ? (
        <Tag color="error">
          <DateText value={value.endsAt} />
          까지
        </Tag>
      ) : (
        '-'
      ),
  },
  {
    title: '가입일',
    dataIndex: 'createdAt',
    key: 'createdAt',
    sorter: true,
    render: (value) => <DateText value={value} />,
  },
];

/** ADM-02 회원 목록 (M10). */
export default function UserListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useListParams({ sort: DEFAULT_SORT });
  const query = useUsers(params);

  const filterValue = {
    query: params.query,
    status: params.status,
    restricted: params.restricted,
    from: params.joinedFrom,
    to: params.joinedTo,
  };
  const handleFilter = ({ from, to, ...rest }) =>
    setParams({ ...rest, joinedFrom: from, joinedTo: to });

  return (
    <>
      <Typography.Title level={3}>회원 목록</Typography.Title>
      <FilterBar fields={FIELDS} value={filterValue} onChange={handleFilter} />
      <DataTable
        query={query}
        columns={COLUMNS}
        defaultSort={DEFAULT_SORT}
        onRowClick={(user) => navigate(`/users/${user.id}`)}
      />
    </>
  );
}
