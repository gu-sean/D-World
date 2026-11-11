// ADM-10 Verification criteria: versions are append-only, so "edit" means "add a new version"
import { useRef, useState } from 'react';
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { newIdempotencyKey } from '../../../api/idempotency.js';
import StatePanel from '../../../components/StatePanel.jsx';
import { formatDateTime, METHOD_LABEL, reasonRules } from '../components/format.js';
import { useCategories, useCreateCriteria, useCriteria } from '../queries.js';

const METHOD_OPTIONS = Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }));

const validateJsonObject = (_, value) => {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return Promise.resolve();
  } catch {
    // Falls through to the rejection below.
  }
  return Promise.reject(new Error('JSON 객체 형식으로 입력해 주세요.'));
};

export default function VerificationCriteriaPage() {
  const [filters, setFilters] = useState({ categoryId: undefined, method: undefined });
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const keyRef = useRef(null);
  const categories = useCategories();
  const criteria = useCriteria(filters);
  const create = useCreateCriteria();

  const categoryOptions = (categories.data ?? []).map((c) => ({ value: c.id, label: c.name }));
  const categoryName = (id) => categoryOptions.find((o) => o.value === id)?.label ?? id;

  const submit = (values) => {
    Modal.confirm({
      title: '새 판정 기준 버전을 추가할까요?',
      content: '기준은 수정하지 않고 새 버전으로 추가됩니다. 시행 시각 이후의 인증에 적용됩니다.',
      okText: '추가',
      cancelText: '취소',
      onOk: async () => {
        keyRef.current ??= newIdempotencyKey();
        try {
          await create.mutateAsync({
            categoryId: values.categoryId,
            verificationMethod: values.verificationMethod,
            rules: JSON.parse(values.rules),
            effectiveAt: values.effectiveAt?.toISOString(),
            reason: values.reason,
            idempotencyKey: keyRef.current,
          });
          keyRef.current = null;
          setOpen(false);
          form.resetFields();
        } catch {
          // Shown by the Alert; the same key is reused when the admin retries.
        }
      },
    });
  };

  const columns = [
    { title: '분야', dataIndex: 'categoryId', render: categoryName },
    { title: '인증 방식', dataIndex: 'verificationMethod', render: (v) => METHOD_LABEL[v] ?? v },
    { title: '버전', dataIndex: 'versionNo', width: 72 },
    { title: '시행 시각', dataIndex: 'effectiveAt', render: formatDateTime },
    {
      title: '기준',
      dataIndex: 'rules',
      render: (rules) => <Typography.Text code>{JSON.stringify(rules)}</Typography.Text>,
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Title level={3}>판정 기준</Typography.Title>
      <Space wrap>
        <Select
          aria-label="분야"
          allowClear
          placeholder="전체 분야"
          style={{ width: 180 }}
          options={categoryOptions}
          onChange={(categoryId) => setFilters((prev) => ({ ...prev, categoryId }))}
        />
        <Select
          aria-label="인증 방식"
          allowClear
          placeholder="전체 방식"
          style={{ width: 140 }}
          options={METHOD_OPTIONS}
          onChange={(method) => setFilters((prev) => ({ ...prev, method }))}
        />
        <Button type="primary" onClick={() => setOpen(true)}>
          새 버전 추가
        </Button>
      </Space>
      <StatePanel
        loading={criteria.isLoading}
        error={criteria.error}
        empty={criteria.data?.length === 0}
        emptyText="등록된 판정 기준이 없습니다."
        onRetry={criteria.refetch}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={criteria.data}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      </StatePanel>
      <Modal
        title="판정 기준 새 버전"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="저장"
        cancelText="취소"
        confirmLoading={create.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item
            label="분야"
            name="categoryId"
            rules={[{ required: true, message: '분야를 선택해 주세요.' }]}
          >
            <Select options={categoryOptions} />
          </Form.Item>
          <Form.Item
            label="인증 방식"
            name="verificationMethod"
            rules={[{ required: true, message: '인증 방식을 선택해 주세요.' }]}
          >
            <Select options={METHOD_OPTIONS} />
          </Form.Item>
          <Form.Item
            label="기준 (JSON)"
            name="rules"
            rules={[
              { required: true, message: '기준을 입력해 주세요.' },
              { validator: validateJsonObject },
            ]}
          >
            <Input.TextArea rows={5} placeholder='{"minConfidence": 0.8}' />
          </Form.Item>
          <Form.Item label="시행 시각 (비우면 즉시)" name="effectiveAt">
            <DatePicker
              showTime
              disabledDate={(date) => date.isBefore(dayjs(), 'day')}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label="변경 사유" name="reason" rules={reasonRules(500)}>
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
          {create.error && <Alert type="error" showIcon message={create.error.message} />}
        </Form>
      </Modal>
    </Space>
  );
}
