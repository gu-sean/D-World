import { useState } from 'react';
import { Button, Modal, Space, Tag, Typography } from 'antd';
import { DataTable } from '../../../components/DataTable.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { PolicyDocumentForm } from '../components/PolicyDocumentForm.jsx';
import { policyDocumentType } from '../labels.js';
import { usePolicyDocuments, usePublishPolicyDocument } from '../queries.js';
import { useConfirm } from '../useConfirm.jsx';

/** ADM-34 약관·정책 (M95~M97): a version is added, never edited, and fixed once published. */
export default function PolicyDocumentPage() {
  const [params] = useListParams();
  const query = usePolicyDocuments(params);
  const publish = usePublishPolicyDocument();
  const [confirmElement, ask] = useConfirm();
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState(null);

  const askPublish = (item) =>
    ask({
      title: '약관 게시',
      danger: true,
      summary: (
        <>
          {policyDocumentType[item.documentType]} {item.version}
          <br />
          게시하면 수정할 수 없어요.
        </>
      ),
      submit: ({ reason, idempotencyKey }) =>
        publish.mutateAsync({ versionId: item.id, body: { reason }, idempotencyKey }),
    });

  const columns = [
    {
      title: '문서 종류',
      dataIndex: 'documentType',
      render: (value) => policyDocumentType[value] ?? value,
    },
    { title: '버전', dataIndex: 'version' },
    { title: '시행 시각', dataIndex: 'effectiveAt', render: (value) => <DateText value={value} /> },
    {
      title: '다시 동의',
      dataIndex: 'requiresReconsent',
      render: (value) => (value ? '필요' : '-'),
    },
    {
      title: '게시',
      dataIndex: 'publishedAt',
      render: (value) =>
        value ? (
          <Space>
            <Tag color="success">게시됨</Tag>
            <DateText value={value} />
          </Space>
        ) : (
          <Tag>미게시</Tag>
        ),
    },
    {
      title: '',
      key: 'actions',
      render: (_, item) => (
        <Space>
          <Button size="small" onClick={() => setViewing(item)}>
            본문 보기
          </Button>
          {!item.publishedAt && (
            <Button size="small" type="primary" onClick={() => askPublish(item)}>
              게시
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={3}>약관·정책</Typography.Title>
        {!creating && (
          <Button type="primary" onClick={() => setCreating(true)}>
            새 버전 만들기
          </Button>
        )}
      </Space>
      {creating && (
        <div style={{ marginBottom: 24 }}>
          <PolicyDocumentForm onConfirm={ask} onClose={() => setCreating(false)} />
        </div>
      )}
      <DataTable query={query} columns={columns} />
      <Modal
        open={Boolean(viewing)}
        title={viewing ? `${policyDocumentType[viewing.documentType]} ${viewing.version}` : ''}
        footer={null}
        onCancel={() => setViewing(null)}
      >
        <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
          {viewing?.body}
        </Typography.Paragraph>
      </Modal>
      {confirmElement}
    </>
  );
}
