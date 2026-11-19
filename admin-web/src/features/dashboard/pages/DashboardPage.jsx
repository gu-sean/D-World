import { Alert, Card, Col, Flex, Row, Segmented, Statistic, Typography } from 'antd';
import dayjs from 'dayjs';
import { Link } from 'react-router';
import { DateText } from '../../../components/DateText.jsx';
import { FilterBar } from '../../../components/FilterBar.jsx';
import { PageHeader } from '../../../components/PageHeader.jsx';
import { QueryBoundary } from '../../../components/QueryBoundary.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { useDashboardSummary } from '../queries.js';
import { lastDays, MAX_PERIOD_DAYS, resolvePeriod } from '../period.js';
import { t } from '../../../i18n/index.js';

// Where each waiting-work queue is handled (docs/parts/admin-web.md §4). The names are the menu
// names of src/app/menu.js.
const QUEUES = {
  verification: { label: t('AI 판정 보류'), path: '/verifications/appeals?tab=hold' },
  appeal: { label: t('이의 신청'), path: '/verifications/appeals' },
  report: { label: t('신고'), path: '/support/abuse' },
  inquiry: { label: t('문의'), path: '/support/inquiries' },
  withdrawal: { label: t('탈퇴 요청'), path: '/users/withdrawals' },
};
const QUEUE_ORDER = Object.keys(QUEUES);

const PERIOD_FIELDS = [{ name: 'period', type: 'dateRange' }]; // writes `from` and `to`

const PERIOD_ERROR_TEXTS = {
  tooLong: t('기간은 최대 {0}일까지 선택할 수 있어요.', MAX_PERIOD_DAYS),
  reversed: t('시작일이 종료일보다 늦을 수 없어요.'),
};

// Statistics of the chosen period. The waiting counts are shown above as work to do.
const STATS = [
  { key: 'activeUserCount', title: t('활동 사용자') },
  { key: 'missionCount', title: t('미션 수') },
];

const PRESETS = [
  { value: 1, label: t('오늘') },
  { value: 7, label: t('최근 7일') },
  { value: 30, label: t('최근 30일') },
];

const WARNING_DAYS = 3; // a queue whose oldest item waited this long is shown in red
const WARNING_COLOR = '#d4380d';
const ATTENTION_COLOR = '#d46b08';

/** One waiting-work card: the count is the first thing the eye finds; the whole card is a link. */
function QueueCard({ queue }) {
  const info = QUEUES[queue.type];
  if (!info) return null;
  const waitedDays = queue.oldestAt ? dayjs().diff(dayjs(queue.oldestAt), 'day') : 0;
  const overdue = queue.count > 0 && waitedDays >= WARNING_DAYS;
  const color = queue.count === 0 ? undefined : overdue ? WARNING_COLOR : ATTENTION_COLOR;
  return (
    <Link
      to={info.path}
      aria-label={`${info.label} ${queue.count}`}
      style={{ display: 'block', height: '100%' }}
    >
      <Card hoverable size="small" style={{ height: '100%' }} styles={{ body: { padding: 16 } }}>
        <Typography.Text type="secondary">{info.label}</Typography.Text>
        <div style={{ fontSize: 32, fontWeight: 600, lineHeight: 1.3, color }}>{queue.count}</div>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {queue.count === 0 ? (
            t('처리할 일이 없어요')
          ) : (
            <>
              {t('가장 오래된 접수')} <DateText value={queue.oldestAt} />
              {overdue ? ` · ${t('{0}일째 대기', waitedDays)}` : ''}
            </>
          )}
        </Typography.Text>
      </Card>
    </Link>
  );
}

/** ADM-01 대시보드 (M05). The period is in the URL (`?from=&to=`), today..today by default. */
export default function DashboardPage() {
  const [params, setParams] = useListParams();
  const period = resolvePeriod(params);
  const query = useDashboardSummary(
    { from: period.from, to: period.to },
    { enabled: period.error === null },
  );
  const preset = PRESETS.find((item) => {
    const range = lastDays(item.value);
    return range.from === period.from && range.to === period.to;
  });

  const periodControls = (
    <Flex wrap gap={12} align="flex-end" style={{ marginBottom: 12 }}>
      <Segmented
        options={PRESETS}
        value={preset?.value}
        onChange={(value) => setParams(lastDays(value))}
      />
      <FilterBar
        compact
        fields={PERIOD_FIELDS}
        value={{ from: params.from, to: params.to }}
        onChange={setParams}
      />
    </Flex>
  );

  if (period.error) {
    return (
      <>
        <PageHeader title={t('대시보드')} />
        {periodControls}
        <Alert type="warning" showIcon title={PERIOD_ERROR_TEXTS[period.error]} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t('대시보드')}
        description={t('처리할 일을 먼저 보고, 아래에서 기간별 현황을 확인해요.')}
      />
      <QueryBoundary query={query}>
        {(summary) => {
          const queues = QUEUE_ORDER.map(
            (type) =>
              summary.queues.find((queue) => queue.type === type) ?? {
                type,
                count: 0,
                oldestAt: null,
              },
          );
          return (
            <>
              <Typography.Title level={4} style={{ marginTop: 0 }}>
                {t('처리 대기 업무')}
              </Typography.Title>
              <Row gutter={[16, 16]}>
                {queues.map((queue) => (
                  <Col key={queue.type} xs={12} md={8} xl={{ flex: '20%' }}>
                    <QueueCard queue={queue} />
                  </Col>
                ))}
              </Row>
              <Typography.Title level={4} style={{ marginTop: 32 }}>
                {t('기간별 현황')}
              </Typography.Title>
              {periodControls}
              <>
                <Typography.Paragraph type="secondary">
                  {t('{0} ~ {1} · 집계 시각', summary.from, summary.to)}{' '}
                  <DateText value={summary.aggregatedAt} />
                </Typography.Paragraph>
                <Row gutter={[16, 16]}>
                  {STATS.map(({ key, title }) => (
                    <Col key={key} xs={12} md={8} xl={6}>
                      <Card data-testid={`stat-${key}`} size="small">
                        <Statistic title={title} value={summary[key]} />
                      </Card>
                    </Col>
                  ))}
                </Row>
              </>
            </>
          );
        }}
      </QueryBoundary>
    </>
  );
}
