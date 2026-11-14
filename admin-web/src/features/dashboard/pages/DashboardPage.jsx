import { Alert, Button, Card, Col, Row, Space, Statistic, Table, Typography } from 'antd';
import { Link } from 'react-router';
import { DateText } from '../../../components/DateText.jsx';
import { FilterBar } from '../../../components/FilterBar.jsx';
import { QueryBoundary } from '../../../components/QueryBoundary.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { useDashboardSummary } from '../queries.js';
import { lastDays, MAX_PERIOD_DAYS, resolvePeriod } from '../period.js';

// Where each waiting-work queue is handled (docs/parts/admin-web.md §4). The names are the menu
// names of src/app/menu.js.
const QUEUES = {
  verification: { label: 'AI 판정 보류', path: '/verifications/appeals?tab=hold' },
  report: { label: '신고', path: '/support/abuse' },
  inquiry: { label: '문의', path: '/support/inquiries' },
  withdrawal: { label: '탈퇴 요청', path: '/users/withdrawals' },
  appeal: { label: '이의 신청', path: '/verifications/appeals' },
};

const PERIOD_FIELDS = [{ name: 'period', type: 'dateRange' }]; // writes `from` and `to`

const PERIOD_ERROR_TEXTS = {
  tooLong: `기간은 최대 ${MAX_PERIOD_DAYS}일까지 선택할 수 있어요.`,
  reversed: '시작일이 종료일보다 늦을 수 없어요.',
};

const STATS = [
  { key: 'activeUserCount', title: '활동 사용자' },
  { key: 'missionCount', title: '미션 수' },
  { key: 'pendingVerificationCount', title: 'AI 판정 보류' },
  { key: 'openReportCount', title: '미처리 신고' },
];

const QUEUE_COLUMNS = [
  { title: '업무', dataIndex: 'type', render: (type) => QUEUES[type]?.label ?? type },
  { title: '대기 건수', dataIndex: 'count' },
  {
    title: '가장 오래된 접수',
    dataIndex: 'oldestAt',
    render: (value) => <DateText value={value} />,
  },
  {
    title: '',
    dataIndex: 'type',
    key: 'link',
    render: (type) => (QUEUES[type] ? <Link to={QUEUES[type].path}>바로가기</Link> : null),
  },
];

/** ADM-01 대시보드 (M05). The period is in the URL (`?from=&to=`), today..today by default. */
export default function DashboardPage() {
  const [params, setParams] = useListParams();
  const period = resolvePeriod(params);
  const query = useDashboardSummary(
    { from: period.from, to: period.to },
    { enabled: period.error === null },
  );

  return (
    <>
      <Typography.Title level={3}>대시보드</Typography.Title>
      <Space wrap style={{ marginBottom: 16 }}>
        <Button onClick={() => setParams(lastDays(1))}>오늘</Button>
        <Button onClick={() => setParams(lastDays(7))}>최근 7일</Button>
        <Button onClick={() => setParams(lastDays(30))}>최근 30일</Button>
      </Space>
      <FilterBar
        fields={PERIOD_FIELDS}
        value={{ from: params.from, to: params.to }}
        onChange={setParams}
      />
      {period.error ? (
        <Alert type="warning" showIcon title={PERIOD_ERROR_TEXTS[period.error]} />
      ) : (
        <QueryBoundary query={query}>
          {(summary) => (
            <>
              <Typography.Paragraph type="secondary">
                {summary.from} ~ {summary.to} · 집계 시각 <DateText value={summary.aggregatedAt} />
              </Typography.Paragraph>
              <Row gutter={[16, 16]}>
                {STATS.map(({ key, title }) => (
                  <Col key={key} xs={24} sm={12} lg={6}>
                    <Card data-testid={`stat-${key}`}>
                      <Statistic title={title} value={summary[key]} />
                    </Card>
                  </Col>
                ))}
              </Row>
              <Typography.Title level={4} style={{ marginTop: 32 }}>
                처리 대기 업무
              </Typography.Title>
              <Table
                rowKey="type"
                size="middle"
                pagination={false}
                columns={QUEUE_COLUMNS}
                dataSource={summary.queues}
              />
            </>
          )}
        </QueryBoundary>
      )}
    </>
  );
}
