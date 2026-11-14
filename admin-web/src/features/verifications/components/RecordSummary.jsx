import { Descriptions, Space, Table, Tag, Typography } from 'antd';
import { DateText } from '../../../components/DateText.jsx';
import { MemberCell } from '../../../components/MemberCell.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import EvidenceViewer from './EvidenceViewer.jsx';
import { formatConfidence, formatTarget, METHOD_LABEL } from './format.js';
import MetricsTable from './MetricsTable.jsx';

const resultColumns = [
  { title: '회차', dataIndex: 'resultNo', width: 64 },
  {
    title: '판정 주체',
    dataIndex: 'source',
    render: (value) => <StatusTag kind="decisionSource" value={value} />,
  },
  {
    title: '판정',
    dataIndex: 'decision',
    render: (value) => <StatusTag kind="decision" value={value} />,
  },
  { title: '신뢰도', dataIndex: 'confidence', render: formatConfidence },
  { title: '엔진', dataIndex: 'engineVersion', render: (value) => value ?? '-' },
  { title: '사유', dataIndex: 'reason', render: (value) => value ?? '-' },
  { title: '판정 시각', dataIndex: 'decidedAt', render: (value) => <DateText value={value} /> },
  {
    title: '현재',
    dataIndex: 'isCurrent',
    width: 64,
    render: (value) => (value ? <Tag color="blue">현재</Tag> : null),
  },
];

const appealColumns = [
  { title: '접수 시각', dataIndex: 'filedAt', render: (value) => <DateText value={value} /> },
  {
    title: '상태',
    dataIndex: 'status',
    render: (value) => <StatusTag kind="verificationAppealStatus" value={value} />,
  },
  { title: '사유', dataIndex: 'reason' },
  { title: '처리 시각', dataIndex: 'resolvedAt', render: (value) => <DateText value={value} /> },
];

/** Read-only view of a verification record (response of M32). */
export default function RecordSummary({ record }) {
  const { mission } = record;
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Descriptions title="수행 회차" bordered size="small" column={2}>
        <Descriptions.Item label="회차 ID">{record.recordId}</Descriptions.Item>
        <Descriptions.Item label="상태">
          <StatusTag kind="recordStatus" value={record.status} />
        </Descriptions.Item>
        <Descriptions.Item label="회원">
          <MemberCell id={record.userId} nickname={record.userNickname} />
        </Descriptions.Item>
        <Descriptions.Item label="증거 종류">
          {record.evidenceKind ? (
            <StatusTag kind="recordEvidenceKind" value={record.evidenceKind} />
          ) : (
            '-'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="시도 / 제출 번호">
          {record.attemptNo} / {record.submissionNo}
        </Descriptions.Item>
        <Descriptions.Item label="제출 시각">
          <DateText value={record.submittedAt} />
        </Descriptions.Item>
        <Descriptions.Item label="시작 시각">
          <DateText value={record.startedAt} />
        </Descriptions.Item>
        <Descriptions.Item label="완료 시각">
          <DateText value={record.completedAt} />
        </Descriptions.Item>
      </Descriptions>

      <Descriptions title="미션 조건" bordered size="small" column={2}>
        <Descriptions.Item label="제목">{mission.title}</Descriptions.Item>
        <Descriptions.Item label="인증 방식">
          {METHOD_LABEL[mission.verificationMethod] ?? mission.verificationMethod}
        </Descriptions.Item>
        <Descriptions.Item label="목표">{formatTarget(mission)}</Descriptions.Item>
        <Descriptions.Item label="예정일">
          <DateText value={mission.scheduledDate} />
        </Descriptions.Item>
        <Descriptions.Item label="설명" span={2}>
          {mission.description ?? '-'}
        </Descriptions.Item>
      </Descriptions>

      <div>
        <Typography.Title level={5}>증거 파일</Typography.Title>
        <EvidenceViewer files={record.files} duplicateOfMediaId={record.duplicateOfMediaId} />
      </div>

      <div>
        <Typography.Title level={5}>판정 이력과 측정값</Typography.Title>
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
        <Typography.Title level={5}>이의 제기</Typography.Title>
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          columns={appealColumns}
          dataSource={record.appeals ?? []}
          locale={{ emptyText: '이의 제기가 없어요.' }}
        />
      </div>
    </Space>
  );
}
