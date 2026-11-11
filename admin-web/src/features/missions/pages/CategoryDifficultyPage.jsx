// ADM-15 Categories, difficulties and reward rates
import { useState } from 'react';
import {
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Switch,
  Table,
  Tabs,
  Typography,
} from 'antd';
import QueryState from '../../../components/QueryState.jsx';
import confirmWithReason from '../confirmWithReason.jsx';
import { formatDateTime } from '../constants.js';
import {
  useCatalog,
  useCreateCatalogItem,
  useCreateRewardRate,
  useRewardRates,
  useUpdateCatalogItem,
} from '../queries.js';

const KIND_LABEL = { categories: '분야', difficulties: '난이도' };

function CatalogTab({ kind }) {
  const label = KIND_LABEL[kind];
  const { data = [], isLoading, error, refetch } = useCatalog(kind);
  const create = useCreateCatalogItem(kind);
  const update = useUpdateCatalogItem(kind);
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);

  const openCreate = () => {
    form.resetFields();
    setOpen(true);
  };
  const submitCreate = (values) => {
    setOpen(false);
    confirmWithReason({
      title: `${label}를 추가할까요?`,
      okText: '추가',
      onOk: async (reason, idempotencyKey) => {
        await create.mutateAsync({ body: { ...values, reason }, idempotencyKey });
        message.success('변경 사항을 저장했습니다.');
      },
    });
  };
  const changeActive = (row, isActive) =>
    confirmWithReason({
      title: `${row.name}을(를) ${isActive ? '사용' : '사용 중지'}할까요?`,
      okText: '확인',
      danger: !isActive,
      onOk: async (reason, idempotencyKey) => {
        await update.mutateAsync({ id: row.id, body: { isActive, reason }, idempotencyKey });
        message.success('변경 사항을 저장했습니다.');
      },
    });

  const columns = [
    { title: '코드', dataIndex: 'code' },
    { title: '이름', dataIndex: 'name' },
    { title: '표시 순서', dataIndex: 'displayOrder' },
    {
      title: '사용',
      dataIndex: 'isActive',
      render: (value, row) => (
        <Switch checked={value} onChange={(next) => changeActive(row, next)} />
      ),
    },
  ];

  return (
    <QueryState loading={isLoading} error={error} onRetry={refetch} empty={data.length === 0}>
      <Button type="primary" style={{ marginBottom: 16 }} onClick={openCreate}>
        {label} 추가
      </Button>
      <Table rowKey="id" columns={columns} dataSource={data} pagination={false} />
      <Modal
        title={`${label} 추가`}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="다음"
        cancelText="취소"
      >
        <Form form={form} layout="vertical" onFinish={submitCreate}>
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
          <Form.Item
            label="표시 순서"
            name="displayOrder"
            initialValue={data.length + 1}
            rules={[{ required: true }]}
          >
            <InputNumber min={0} precision={0} />
          </Form.Item>
        </Form>
      </Modal>
    </QueryState>
  );
}

function RewardRateTab() {
  const { data: categories = [] } = useCatalog('categories');
  const { data: difficulties = [] } = useCatalog('difficulties');
  const { data = [], isLoading, error, refetch } = useRewardRates({});
  const create = useCreateRewardRate();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const nameOf = (items, id) => items.find((item) => item.id === id)?.name ?? '-';

  const submit = (values) => {
    setOpen(false);
    confirmWithReason({
      title: '보상 기준을 새 버전으로 추가할까요?',
      content: '기존 버전은 그대로 남고, 적용 시각부터 새 기준이 쓰여요.',
      okText: '추가',
      onOk: async (reason, idempotencyKey) => {
        await create.mutateAsync({ body: { ...values, reason }, idempotencyKey });
        message.success('변경 사항을 저장했습니다.');
      },
    });
  };

  const columns = [
    { title: '분야', dataIndex: 'categoryId', render: (id) => nameOf(categories, id) },
    { title: '난이도', dataIndex: 'difficultyId', render: (id) => nameOf(difficulties, id) },
    { title: '버전', dataIndex: 'versionNo' },
    { title: '포인트', dataIndex: 'points' },
    { title: '사용자 경험치', dataIndex: 'userXp' },
    { title: '펫 경험치', dataIndex: 'petXp' },
    { title: '적용 시각', dataIndex: 'effectiveAt', render: formatDateTime },
  ];
  const options = (items) => items.map((item) => ({ value: item.id, label: item.name }));
  const numberRule = [{ required: true, message: '값을 입력해 주세요.' }];

  return (
    <QueryState loading={isLoading} error={error} onRetry={refetch} empty={data.length === 0}>
      <Button
        type="primary"
        style={{ marginBottom: 16 }}
        onClick={() => {
          form.resetFields();
          setOpen(true);
        }}
      >
        새 버전 추가
      </Button>
      <Table rowKey="id" columns={columns} dataSource={data} pagination={false} />
      <Modal
        title="보상 기준 추가"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="다음"
        cancelText="취소"
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item label="분야" name="categoryId" rules={numberRule}>
            <Select options={options(categories)} />
          </Form.Item>
          <Form.Item label="난이도" name="difficultyId" rules={numberRule}>
            <Select options={options(difficulties)} />
          </Form.Item>
          <Form.Item label="포인트" name="points" rules={numberRule}>
            <InputNumber min={0} precision={0} />
          </Form.Item>
          <Form.Item label="사용자 경험치" name="userXp" rules={numberRule}>
            <InputNumber min={0} precision={0} />
          </Form.Item>
          <Form.Item label="펫 경험치" name="petXp" rules={numberRule}>
            <InputNumber min={0} precision={0} />
          </Form.Item>
        </Form>
      </Modal>
    </QueryState>
  );
}

export default function CategoryDifficultyPage() {
  return (
    <div>
      <Typography.Title level={4}>분야·난이도</Typography.Title>
      <Tabs
        items={[
          { key: 'categories', label: '분야', children: <CatalogTab kind="categories" /> },
          { key: 'difficulties', label: '난이도', children: <CatalogTab kind="difficulties" /> },
          { key: 'rates', label: '보상 기준', children: <RewardRateTab /> },
        ]}
      />
    </div>
  );
}
