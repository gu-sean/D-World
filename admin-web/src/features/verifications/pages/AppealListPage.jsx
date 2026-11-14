// ADM-09 처리 대기: 관리자가 판정하는 곳은 여기 한 곳이다.
//   이의 신청: AI 판정에 회원이 이의를 낸 건
//   AI 판정 보류: AI가 확신하지 못해 관리자 판정을 기다리는 건 (예전 "검수 대기")
// 판정이 끝난 인증은 모두 "인증 기록"에 남는다.
import { Link, useNavigate } from 'react-router';
import { Space, Tabs, Typography } from 'antd';
import { DataTable } from '../../../components/DataTable.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { FilterBar } from '../../../components/FilterBar.jsx';
import { MEMBER_FIELD, memberColumn } from '../../../components/memberColumns.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { labels } from '../../../constants/labels.js';
import { formatConfidence, formatTarget, METHOD_LABEL } from '../components/format.js';
import { useAppeals, useVerifications } from '../queries.js';

const APPEAL_FIELDS = [
  MEMBER_FIELD,
  {
    name: 'status',
    type: 'select',
    label: '상태',
    options: Object.entries(labels.verificationAppealStatus).map(([value, { text }]) => ({
      value,
      label: text,
    })),
  },
];
const HOLD_FIELDS = [
  MEMBER_FIELD,
  {
    name: 'method',
    type: 'select',
    label: '인증 방식',
    options: Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label })),
  },
];

function AppealsTab({ params, setParams }) {
  const navigate = useNavigate();
  const query = useAppeals({ status: 'open', sort: 'filedAt,asc', ...params });

  const columns = [
    {
      title: '접수 시각',
      dataIndex: 'filedAt',
      key: 'filedAt',
      sorter: true,
      render: (value, row) => (
        <Link to={`/verifications/appeals/${row.id}`}>
          <DateText value={value} />
        </Link>
      ),
    },
    memberColumn({ idKey: 'userId', nicknameKey: 'nickname' }),
    { title: '미션', dataIndex: 'missionTitle' },
    {
      title: '기존 판정',
      dataIndex: 'originalDecision',
      render: (value) => (value ? <StatusTag kind="decision" value={value} /> : '-'),
    },
    { title: '이의 사유', dataIndex: 'reason', ellipsis: true },
    {
      title: '상태',
      dataIndex: 'status',
      render: (value) => <StatusTag kind="verificationAppealStatus" value={value} />,
    },
    { title: '처리 시각', dataIndex: 'resolvedAt', render: (value) => <DateText value={value} /> },
  ];

  return (
    <>
      <FilterBar fields={APPEAL_FIELDS} value={params} onChange={setParams} />
      <DataTable
        query={query}
        columns={columns}
        defaultSort="filedAt,asc"
        onRowClick={(row) => navigate(`/verifications/appeals/${row.id}`)}
      />
    </>
  );
}

function HoldTab({ params, setParams }) {
  const navigate = useNavigate();
  // 가장 오래 기다린 것부터 (docs/09 §5)
  const query = useVerifications({ sort: 'submittedAt,asc', ...params, status: 'review_required' });

  const columns = [
    {
      title: '제출 시각',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      sorter: true,
      render: (value, row) => (
        <Link to={`/verifications/appeals/hold/${row.recordId}`}>
          <DateText value={value} />
        </Link>
      ),
    },
    memberColumn({ idKey: 'userId', nicknameKey: 'nickname' }),
    { title: '미션', render: (_, row) => row.mission.title },
    {
      title: '인증 방식',
      render: (_, row) => METHOD_LABEL[row.mission.verificationMethod] ?? '-',
    },
    { title: '목표', render: (_, row) => formatTarget(row.mission) },
    { title: 'AI 신뢰도', render: (_, row) => formatConfidence(row.ai?.confidence) },
    { title: 'AI 사유', render: (_, row) => row.ai?.reason ?? '-' },
  ];

  return (
    <>
      <FilterBar fields={HOLD_FIELDS} value={params} onChange={setParams} />
      <DataTable
        query={query}
        rowKey="recordId"
        columns={columns}
        defaultSort="submittedAt,asc"
        onRowClick={(row) => navigate(`/verifications/appeals/hold/${row.recordId}`)}
      />
    </>
  );
}

export default function AppealListPage() {
  const [allParams, setParams] = useListParams();
  const { tab = 'appeals', ...params } = allParams;
  const holdCount = useVerifications({ status: 'review_required', page: 1, size: 1 }).data
    ?.totalCount;
  const appealCount = useAppeals({ status: 'open', page: 1, size: 1 }).data?.totalCount;
  const keepTab = (patch) => setParams({ ...patch, tab });
  const count = (n) => (typeof n === 'number' ? ` (${n})` : '');

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Title level={3}>처리 대기</Typography.Title>
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        AI가 먼저 판정하고, 관리자는 회원이 이의를 낸 건과 AI가 판정을 보류한 건만 처리해요. 모든
        인증 결과는 <Link to="/verifications">인증 기록</Link>에 남아요.
      </Typography.Paragraph>
      <Tabs
        activeKey={tab}
        // 탭을 바꾸면 검색 조건을 비운다 (두 목록의 필터가 다름)
        onChange={(next) => setParams({ tab: next, member: '', status: '', method: '', sort: '' })}
        destroyOnHidden
        items={[
          {
            key: 'appeals',
            label: `이의 신청${count(appealCount)}`,
            children: <AppealsTab params={params} setParams={keepTab} />,
          },
          {
            key: 'hold',
            label: `AI 판정 보류${count(holdCount)}`,
            children: <HoldTab params={params} setParams={keepTab} />,
          },
        ]}
      />
    </Space>
  );
}
