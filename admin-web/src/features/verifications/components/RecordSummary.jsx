import { Descriptions, Image, Space, Table, Tag, Typography } from 'antd';
import {
  APPEAL_STATUS,
  DECISION_LABEL,
  formatConfidence,
  formatDateTime,
  formatTarget,
  METHOD_LABEL,
  RECORD_STATUS,
  SOURCE_LABEL,
} from './format.js';

export const StatusTag = ({ map, value }) => {
  const entry = map[value];
  return <Tag color={entry?.color}>{entry?.label ?? value ?? '-'}</Tag>;
};

const Json = ({ value }) =>
  value == null ? (
    '-'
  ) : (
    <Typography.Text code style={{ whiteSpace: 'pre-wrap' }}>
      {JSON.stringify(value)}
    </Typography.Text>
  );

const resultColumns = [
  { title: '회차', dataIndex: 'resultNo', width: 64 },
  { title: '판정 주체', dataIndex: 'source', render: (v) => SOURCE_LABEL[v] ?? v },
  { title: '판정', dataIndex: 'decision', render: (v) => DECISION_LABEL[v] ?? v },
  { title: '신뢰도', dataIndex: 'confidence', render: formatConfidence },
  { title: '엔진', dataIndex: 'engineVersion', render: (v) => v ?? '-' },
  { title: '사유', dataIndex: 'reason', render: (v) => v ?? '-' },
  { title: '측정값', dataIndex: 'metrics', render: (v) => <Json value={v} /> },
  { title: '판정 시각', dataIndex: 'decidedAt', render: formatDateTime },
  {
    title: '현재',
    dataIndex: 'isCurrent',
    width: 64,
    render: (v) => (v ? <Tag color="blue">현재</Tag> : null),
  },
];

const appealColumns = [
  { title: '접수 시각', dataIndex: 'filedAt', render: formatDateTime },
  {
    title: '상태',
    dataIndex: 'status',
    render: (v) => <StatusTag map={APPEAL_STATUS} value={v} />,
  },
  { title: '사유', dataIndex: 'reason' },
  { title: '처리 시각', dataIndex: 'resolvedAt', render: formatDateTime },
];

const isImage = (file) => file.mimeType?.startsWith('image/');
const isVideo = (file) => file.mimeType?.startsWith('video/');

/** Read-only view of a verification record (response of M32). */
export default function RecordSummary({ record }) {
  const { mission } = record;
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Descriptions title="수행 회차" bordered size="small" column={2}>
        <Descriptions.Item label="회차 ID">{record.recordId}</Descriptions.Item>
        <Descriptions.Item label="상태">
          <StatusTag map={RECORD_STATUS} value={record.status} />
        </Descriptions.Item>
        <Descriptions.Item label="사용자">
          {record.userNickname ?? '-'} ({record.userId})
        </Descriptions.Item>
        <Descriptions.Item label="증거 종류">{record.evidenceKind ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="시도 / 제출 번호">
          {record.attemptNo} / {record.submissionNo}
        </Descriptions.Item>
        <Descriptions.Item label="제출 시각">
          {formatDateTime(record.submittedAt)}
        </Descriptions.Item>
        <Descriptions.Item label="시작 시각">{formatDateTime(record.startedAt)}</Descriptions.Item>
        <Descriptions.Item label="완료 시각">
          {formatDateTime(record.completedAt)}
        </Descriptions.Item>
        <Descriptions.Item label="측정값" span={2}>
          <Json value={record.metrics} />
        </Descriptions.Item>
      </Descriptions>

      <Descriptions title="미션 조건" bordered size="small" column={2}>
        <Descriptions.Item label="제목">{mission.title}</Descriptions.Item>
        <Descriptions.Item label="인증 방식">
          {METHOD_LABEL[mission.verificationMethod] ?? mission.verificationMethod}
        </Descriptions.Item>
        <Descriptions.Item label="목표">{formatTarget(mission)}</Descriptions.Item>
        <Descriptions.Item label="예정일">{mission.scheduledDate ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="설명" span={2}>
          {mission.description ?? '-'}
        </Descriptions.Item>
      </Descriptions>

      <div>
        <Typography.Title level={5}>증거 파일</Typography.Title>
        {record.files?.length ? (
          <Space wrap align="start">
            {record.files.map((file) =>
              file.url && isImage(file) ? (
                <Image key={file.id} src={file.url} width={200} alt="증거 이미지" />
              ) : file.url && isVideo(file) ? (
                <video key={file.id} src={file.url} width={280} controls />
              ) : (
                <Tag key={file.id}>
                  {file.mediaKind} ({file.status})
                </Tag>
              ),
            )}
          </Space>
        ) : (
          <Typography.Text type="secondary">증거 파일이 없습니다.</Typography.Text>
        )}
      </div>

      <div>
        <Typography.Title level={5}>판정 이력</Typography.Title>
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          columns={resultColumns}
          dataSource={record.results ?? []}
          scroll={{ x: 'max-content' }}
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
          locale={{ emptyText: '이의 제기가 없습니다.' }}
        />
      </div>
    </Space>
  );
}
