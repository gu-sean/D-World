// ADM-10 Verification criteria: versions are append-only, so "edit" means "add a new version"
import { useState } from 'react';
import { Button, DatePicker, Form, Modal, Select, Typography } from 'antd';
import { message } from '../../../lib/message.jsx';
import dayjs from 'dayjs';
import { ConfirmActionModal } from '../../../components/ConfirmActionModal.jsx';
import { FilterBar } from '../../../components/FilterBar.jsx';
import { JsonEditor } from '../../../components/JsonEditor.jsx';
import { QueryBoundary } from '../../../components/QueryBoundary.jsx';
import { useListParams } from '../../../components/useListParams.js';
import CriteriaVersionList from '../components/CriteriaVersionList.jsx';
import { METHOD_LABEL } from '../components/format.js';
import { useCategories, useCreateCriteria, useCriteria } from '../queries.js';
import { t } from '../../../i18n/index.js';
import { PageHeader } from '../../../components/PageHeader.jsx';
import { Stack } from '../../../components/Stack.jsx';

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
    { name: 'categoryId', type: 'select', label: t('분야'), options: categoryOptions },
    { name: 'method', type: 'select', label: t('인증 방식'), options: METHOD_OPTIONS },
  ];

  const closeForm = () => {
    setFormOpen(false);
    setDraft(null);
    setRulesText('');
    setRules(undefined);
    form.resetFields();
  };

  return (
    <Stack size="middle">
      <PageHeader
        title={t('판정 기준')}
        description={t('정책은 수정하지 않고 새 버전을 추가해요.')}
      />
      <FilterBar
        fields={filterFields}
        value={params}
        onChange={setParams}
        extra={
          <Button type="primary" onClick={() => setFormOpen(true)}>
            {t('새 버전 추가')}
          </Button>
        }
      />
      <QueryBoundary query={criteria}>
        {(versions) =>
          versions.length === 0 ? (
            <Typography.Text type="secondary">{t('등록된 판정 기준이 없어요.')}</Typography.Text>
          ) : (
            <CriteriaVersionList versions={versions} categoryName={categoryName} />
          )
        }
      </QueryBoundary>

      <Modal
        title={t('판정 기준 새 버전')}
        open={formOpen}
        onCancel={closeForm}
        onOk={() => form.submit()}
        okText={t('저장')}
        cancelText={t('취소')}
        okButtonProps={{ disabled: !isObject(rules) }}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={(values) => setDraft(values)}>
          <Form.Item
            label={t('분야')}
            name="categoryId"
            rules={[{ required: true, message: t('분야를 선택해 주세요.') }]}
          >
            <Select options={categoryOptions} />
          </Form.Item>
          <Form.Item
            label={t('인증 방식')}
            name="verificationMethod"
            rules={[{ required: true, message: t('인증 방식을 선택해 주세요.') }]}
          >
            <Select options={METHOD_OPTIONS} />
          </Form.Item>
          <Form.Item label={t('기준 (JSON 객체)')} required>
            <JsonEditor
              value={rulesText}
              onChange={(text, parsed) => {
                setRulesText(text);
                setRules(parsed);
              }}
            />
          </Form.Item>
          <Form.Item label={t('시행 시각 (비우면 즉시)')} name="effectiveAt">
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
        title={t('새 판정 기준 버전을 추가할까요?')}
        summary={t('기준은 수정하지 않고 새 버전으로 추가돼요. 이미 내린 판정은 바뀌지 않아요.')}
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
          message.success(t('처리했어요'));
          closeForm();
        }}
      />
    </Stack>
  );
}
