// ADM-15 분야·난이도 (미션 보상표는 보상 관리 > 포인트 정책 > 미션 보상표 한 곳에서 관리)
import { useState } from 'react';
import {
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Switch,
  Table,
  Tabs,
  Typography,
} from 'antd';
import { ConfirmActionModal } from '../../../components/ConfirmActionModal.jsx';
import { QueryBoundary } from '../../../components/QueryBoundary.jsx';
import { StatePanel } from '../../../components/StatePanel.jsx';
import { useCatalog, useCreateCatalogItem, useUpdateCatalogItem } from '../queries.js';

const KIND_LABEL = { categories: '분야', difficulties: '난이도' };

function CatalogTab({ kind }) {
  const label = KIND_LABEL[kind];
  const query = useCatalog(kind);
  const create = useCreateCatalogItem(kind);
  const update = useUpdateCatalogItem(kind);
  const [form] = Form.useForm();
  const [formOpen, setFormOpen] = useState(false);
  const [pending, setPending] = useState(null); // {type: 'create', values} | {type: 'active', row, isActive}

  const columns = [
    { title: '코드', dataIndex: 'code' },
    { title: '이름', dataIndex: 'name' },
    { title: '표시 순서', dataIndex: 'displayOrder' },
    {
      title: '사용',
      dataIndex: 'isActive',
      render: (value, row) => (
        <Switch
          checked={value}
          onChange={(isActive) => setPending({ type: 'active', row, isActive })}
        />
      ),
    },
  ];

  const summary =
    pending?.type === 'create'
      ? `${label} 추가 · ${pending.values.name}`
      : pending
        ? `${pending.row.name} · ${pending.isActive ? '사용' : '사용 중지'}`
        : '';

  return (
    <QueryBoundary query={query}>
      {(data) => (
        <>
          <Button
            type="primary"
            style={{ marginBottom: 16 }}
            onClick={() => {
              form.resetFields();
              form.setFieldValue('displayOrder', data.length + 1);
              setFormOpen(true);
            }}
          >
            {label} 추가
          </Button>
          {data.length === 0 ? (
            <StatePanel type="empty" />
          ) : (
            <Table rowKey="id" columns={columns} dataSource={data} pagination={false} />
          )}
          <Modal
            title={`${label} 추가`}
            open={formOpen}
            onCancel={() => setFormOpen(false)}
            onOk={() => form.submit()}
            okText="다음"
            cancelText="취소"
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={(values) => {
                setFormOpen(false);
                setPending({ type: 'create', values });
              }}
            >
              <Form.Item
                label="코드"
                name="code"
                rules={[{ required: true, message: '코드를 입력해 주세요.' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="이름"
                name="name"
                rules={[{ required: true, message: '이름을 입력해 주세요.' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item label="표시 순서" name="displayOrder" rules={[{ required: true }]}>
                <InputNumber min={0} precision={0} />
              </Form.Item>
            </Form>
          </Modal>
          <ConfirmActionModal
            open={Boolean(pending)}
            title={pending?.type === 'create' ? `${label} 추가` : `${label} 사용 여부 변경`}
            summary={summary}
            danger={pending?.type === 'active' && !pending.isActive}
            onSubmit={async ({ reason, idempotencyKey }) => {
              if (pending.type === 'create') {
                await create.mutateAsync({ body: { ...pending.values, reason }, idempotencyKey });
              } else {
                await update.mutateAsync({
                  id: pending.row.id,
                  body: { isActive: pending.isActive, reason },
                  idempotencyKey,
                });
              }
              message.success('처리했어요');
              setPending(null);
            }}
            onCancel={() => setPending(null)}
          />
        </>
      )}
    </QueryBoundary>
  );
}

export default function CategoryDifficultyPage() {
  return (
    <div>
      <Typography.Title level={4}>분야·난이도</Typography.Title>
      <Typography.Paragraph type="secondary">
        미션 보상표는 보상 관리 &gt; 포인트 정책 &gt; 미션 보상표에서 관리해요.
      </Typography.Paragraph>
      <Tabs
        items={[
          { key: 'categories', label: '분야', children: <CatalogTab kind="categories" /> },
          { key: 'difficulties', label: '난이도', children: <CatalogTab kind="difficulties" /> },
        ]}
      />
    </div>
  );
}
