import { Descriptions, Table, Tag, Typography } from 'antd';
import { DateText } from '../../../components/DateText.jsx';
import { MemberCell } from '../../../components/MemberCell.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import EvidenceViewer from './EvidenceViewer.jsx';
import { formatConfidence, formatTarget, METHOD_LABEL } from './format.js';
import MetricsTable from './MetricsTable.jsx';
import RunRouteImage from './RunRouteImage.jsx';
import { t } from '../../../i18n/index.js';
import { Stack } from '../../../components/Stack.jsx';

const resultColumns = [
  { title: t('회차'), dataIndex: 'resultNo', width: 64 },
  {
    title: t('판정 주체'),
    dataIndex: 'source',
    render: (value) => <StatusTag kind="decisionSource" value={value} />,
  },
  {
    title: t('판정'),
    dataIndex: 'decision',
    render: (value) => <StatusTag kind="decision" value={value} />,
  },
  { title: t('신뢰도'), dataIndex: 'confidence', render: formatConfidence },
  { title: t('엔진'), dataIndex: 'engineVersion', render: (value) => value ?? '-' },
  { title: t('사유'), dataIndex: 'reason', render: (value) => value ?? '-' },
  { title: t('판정 시각'), dataIndex: 'decidedAt', render: (value) => <DateText value={value} /> },
  {
    title: t('현재'),
    dataIndex: 'isCurrent',
    width: 64,
    render: (value) => (value ? <Tag color="blue">{t('현재')}</Tag> : null),
  },
];

const appealColumns = [
  { title: t('접수 시각'), dataIndex: 'filedAt', render: (value) => <DateText value={value} /> },
  {
    title: t('상태'),
    dataIndex: 'status',
    render: (value) => <StatusTag kind="verificationAppealStatus" value={value} />,
  },
  { title: t('사유'), dataIndex: 'reason' },
  { title: t('처리 시각'), dataIndex: 'resolvedAt', render: (value) => <DateText value={value} /> },
];

/** Read-only view of a verification record (response of M32). */
export default function RecordSummary({ record }) {
  const { mission } = record;
  return (
    <Stack size="large">
      <Descriptions title={t('수행 회차')} bordered size="small" column={2}>
        <Descriptions.Item label={t('회차 ID')}>{record.recordId}</Descriptions.Item>
        <Descriptions.Item label={t('상태')}>
          <StatusTag kind="recordStatus" value={record.status} />
        </Descriptions.Item>
        <Descriptions.Item label={t('회원')}>
          <MemberCell id={record.userId} nickname={record.userNickname} />
        </Descriptions.Item>
        <Descriptions.Item label={t('증거 종류')}>
          {record.evidenceKind ? (
            <StatusTag kind="recordEvidenceKind" value={record.evidenceKind} />
          ) : (
            '-'
          )}
        </Descriptions.Item>
        <Descriptions.Item label={t('시도 / 제출 번호')}>
          {record.attemptNo} / {record.submissionNo}
        </Descriptions.Item>
        <Descriptions.Item label={t('제출 시각')}>
          <DateText value={record.submittedAt} />
        </Descriptions.Item>
        <Descriptions.Item label={t('시작 시각')}>
          <DateText value={record.startedAt} />
        </Descriptions.Item>
        <Descriptions.Item label={t('완료 시각')}>
          <DateText value={record.completedAt} />
        </Descriptions.Item>
      </Descriptions>

      <Descriptions title={t('미션 조건')} bordered size="small" column={2}>
        <Descriptions.Item label={t('제목')}>{mission.title}</Descriptions.Item>
        <Descriptions.Item label={t('인증 방식')}>
          {METHOD_LABEL[mission.verificationMethod] ?? mission.verificationMethod}
        </Descriptions.Item>
        <Descriptions.Item label={t('목표')}>{formatTarget(mission)}</Descriptions.Item>
        <Descriptions.Item label={t('예정일')}>
          <DateText value={mission.scheduledDate} />
        </Descriptions.Item>
        <Descriptions.Item label={t('설명')} span={2}>
          {mission.description ?? '-'}
        </Descriptions.Item>
      </Descriptions>

      <div>
        <Typography.Title level={5}>{t('증거 파일')}</Typography.Title>
        <EvidenceViewer files={record.files} duplicateOfMediaId={record.duplicateOfMediaId} />
      </div>

      {mission.verificationMethod === 'sensor' && (
        <div>
          <Typography.Title level={5}>{t('러닝 경로')}</Typography.Title>
          <RunRouteImage recordId={record.recordId} />
        </div>
      )}

      <div>
        <Typography.Title level={5}>{t('판정 이력과 측정값')}</Typography.Title>
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          columns={resultColumns}
          dataSource={record.results ?? []}
          scroll={{ x: 'max-content' }}
          expandable={{
            expandedRowRender: (result) => <MetricsTable metrics={result.metrics} />,
            defaultExpandedRowKeys: (record.results ?? [])
              .filter((result) => result.isCurrent)
              .map((result) => result.id),
          }}
        />
      </div>

      <div>
        <Typography.Title level={5}>{t('이의 제기')}</Typography.Title>
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          columns={appealColumns}
          dataSource={record.appeals ?? []}
          locale={{ emptyText: t('이의 제기가 없어요.') }}
        />
      </div>
    </Stack>
  );
}
