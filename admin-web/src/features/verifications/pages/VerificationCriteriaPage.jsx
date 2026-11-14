// ADM-10 Verification criteria: versions are append-only, so "edit" means "add a new version"
import { useState } from 'react';
import { Button, DatePicker, Form, message, Modal, Select, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import { ConfirmActionModal } from '../../../components/ConfirmActionModal.jsx';
import { FilterBar } from '../../../components/FilterBar.jsx';
import { JsonEditor } from '../../../components/JsonEditor.jsx';
import { QueryBoundary } from '../../../components/QueryBoundary.jsx';
import { useListParams } from '../../../components/useListParams.js';
import CriteriaVersionList from '../components/CriteriaVersionList.jsx';
import { METHOD_LABEL } from '../components/format.js';
import { useCategories, useCreateCriteria, useCriteria } from '../queries.js';

const METHOD_OPTIONS = Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }));
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export default function VerificationCriteriaPage() {
  const [params, setParams] = useListParams();
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState(null); // values waiting for the reason (confirm modal)
  const [rulesText, setRulesText] = useState('');
  const [rules, setRules] = useState(undefined);
  const [form] = Form.useForm();
  const categories = useCategories();
  const criteria = useCriteria({
    categoryId: params.categoryId || undefined,
    method: params.method || undefined,
  });
  const create = useCreateCriteria();

  const categoryOptions = (categories.data ?? []).map((c) => ({ value: c.id, label: c.name }));
  const categoryName = (id) => categoryOptions.find((o) => o.value === id)?.label ?? id;
  const filterFields = [
    { name: 'categoryId', type: 'select', label: '분야', options: categoryOptions },
    { name: 'method', type: 'select', label: '인증 방식', options: METHOD_OPTIONS },
  ];

  const closeForm = () => {
    setFormOpen(false);
    setDraft(null);
    setRulesText('');
    setRules(undefined);
    form.resetFields();
  };

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Title level={3}>판정 기준</Typography.Title>
      <Space wrap>
        <FilterBar fields={filterFields} value={params} onChange={setParams} />
        <Button type="primary" style={{ marginBottom: 16 }} onClick={() => setFormOpen(true)}>
          새 버전 추가
        </Button>
      </Space>
      <QueryBoundary query={criteria}>
        {(versions) =>
          versions.length === 0 ? (
            <Typography.Text type="secondary">등록된 판정 기준이 없어요.</Typography.Text>
          ) : (
            <CriteriaVersionList versions={versions} categoryName={categoryName} />
          )
        }
      </QueryBoundary>

      <Modal
        title="판정 기준 새 버전"
        open={formOpen}
        onCancel={closeForm}
        onOk={() => form.submit()}
        okText="저장"
        cancelText="취소"
        okButtonProps={{ disabled: !isObject(rules) }}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={(values) => setDraft(values)}>
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
          <Form.Item label="기준 (JSON 객체)" required>
            <JsonEditor
              value={rulesText}
              onChange={(text, parsed) => {
                setRulesText(text);
                setRules(parsed);
              }}
            />
          </Form.Item>
          <Form.Item label="시행 시각 (비우면 즉시)" name="effectiveAt">
            <DatePicker
              showTime
              disabledDate={(date) => date.isBefore(dayjs(), 'day')}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      <ConfirmActionModal
        open={draft !== null}
        title="새 판정 기준 버전을 추가할까요?"
        summary="기준은 수정하지 않고 새 버전으로 추가돼요. 이미 내린 판정은 바뀌지 않아요."
        onCancel={() => setDraft(null)}
        onSubmit={async ({ reason, idempotencyKey }) => {
          await create.mutateAsync({
            categoryId: draft.categoryId,
            verificationMethod: draft.verificationMethod,
            rules,
            effectiveAt: draft.effectiveAt?.toISOString(),
            reason,
            idempotencyKey,
          });
          message.success('처리했어요');
          closeForm();
        }}
      />
    </Space>
  );
}
