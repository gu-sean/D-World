// ADM-14 Mission definition create / edit
import { useState } from 'react';
import { Button, Form, Input, InputNumber, Select, Space, Typography } from 'antd';
import { message } from '../../../lib/message.jsx';
import { useNavigate, useParams } from 'react-router';
import { ConfirmActionModal } from '../../../components/ConfirmActionModal.jsx';
import { QueryBoundary } from '../../../components/QueryBoundary.jsx';
import { ADMIN_STATUS_OPTIONS, EXERCISE_OPTIONS, METHOD_OPTIONS } from '../constants.js';
import { useCatalog, useCreateDefinition, useDefinition, useUpdateDefinition } from '../queries.js';
import { t } from '../../../i18n/index.js';

const FIELDS = [
  'title',
  'description',
  'categoryId',
  'difficultyId',
  'exerciseCode',
  'verificationMethod',
  'targetValue',
  'targetUnit',
  'estimatedDurationSeconds',
  'publicationStatus',
];

// Running is the only sensor exercise; every other exercise uses the camera (backend rule).
const methodMismatch = (exerciseCode, method) =>
  Boolean(exerciseCode) && (exerciseCode === 'running') !== (method === 'sensor');

function DefinitionForm({ definition }) {
  const { definitionId } = useParams();
  const isEdit = Boolean(definitionId);
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { data: categories = [] } = useCatalog('categories');
  const { data: difficulties = [] } = useCatalog('difficulties');
  const create = useCreateDefinition();
  const update = useUpdateDefinition();
  const [body, setBody] = useState(null); // the payload waiting for the confirm modal

  const submit = (values) => {
    if (methodMismatch(values.exerciseCode, values.verificationMethod)) {
      message.error(t('달리기는 센서, 나머지 운동은 카메라 인증만 가능해요.'));
      return;
    }
    const changed = Object.fromEntries(
      FIELDS.filter(
        (key) => values[key] !== undefined && values[key] !== null && values[key] !== '',
      )
        .filter((key) => !isEdit || values[key] !== definition?.[key])
        .map((key) => [key, values[key]]),
    );
    if (isEdit && Object.keys(changed).length === 0) {
      message.info(t('바꾼 항목이 없어요.'));
      return;
    }
    setBody(changed);
  };

  const options = (items) => items.map((item) => ({ value: item.id, label: item.name }));

  return (
    <>
      <Form
        form={form}
        layout="vertical"
        onFinish={submit}
        initialValues={definition ?? { publicationStatus: 'public', verificationMethod: 'camera' }}
      >
        <Form.Item
          label={t('제목')}
          name="title"
          rules={[
            { required: true, whitespace: true, message: t('제목을 입력해 주세요.') },
            { max: 200, message: t('200자 이하로 입력해 주세요.') },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item label={t('설명')} name="description" rules={[{ max: 2000 }]}>
          <Input.TextArea rows={3} />
        </Form.Item>
        <Space align="start" wrap>
          <Form.Item
            label={t('분야')}
            name="categoryId"
            rules={[{ required: true, message: t('분야를 선택해 주세요.') }]}
          >
            <Select style={{ width: 200 }} options={options(categories)} />
          </Form.Item>
          <Form.Item
            label={t('난이도')}
            name="difficultyId"
            rules={[{ required: true, message: t('난이도를 선택해 주세요.') }]}
          >
            <Select style={{ width: 200 }} options={options(difficulties)} />
          </Form.Item>
        </Space>
        <Space align="start" wrap>
          <Form.Item label={t('운동 종류')} name="exerciseCode">
            <Select allowClear style={{ width: 200 }} options={EXERCISE_OPTIONS} />
          </Form.Item>
          <Form.Item
            label={t('인증 방식')}
            name="verificationMethod"
            rules={[{ required: true, message: t('인증 방식을 선택해 주세요.') }]}
          >
            <Select style={{ width: 200 }} options={METHOD_OPTIONS} />
          </Form.Item>
        </Space>
        <Space align="start" wrap>
          <Form.Item label={t('목표 값')} name="targetValue">
            <InputNumber min={0.01} max={99999999.99} />
          </Form.Item>
          <Form.Item label={t('목표 단위')} name="targetUnit" rules={[{ max: 20 }]}>
            <Input style={{ width: 120 }} />
          </Form.Item>
          <Form.Item label={t('예상 소요 시간(초)')} name="estimatedDurationSeconds">
            <InputNumber min={1} max={86400} precision={0} />
          </Form.Item>
        </Space>
        <Form.Item label={t('공개 상태')} name="publicationStatus">
          <Select style={{ width: 200 }} options={ADMIN_STATUS_OPTIONS} />
        </Form.Item>
        <Space>
          <Button onClick={() => navigate('/missions/definitions')}>{t('취소')}</Button>
          <Button type="primary" htmlType="submit">
            {isEdit ? t('수정') : t('등록')}
          </Button>
        </Space>
      </Form>
      <ConfirmActionModal
        open={Boolean(body)}
        title={isEdit ? t('미션 틀 수정') : t('미션 틀 등록')}
        summary={
          isEdit
            ? t('{0} · 이미 만들어진 미션에는 영향이 없어요.', definition.title)
            : t('{0} · 등록', body?.title ?? '')
        }
        onSubmit={async ({ reason, idempotencyKey }) => {
          const payload = { ...body, reason };
          if (isEdit) await update.mutateAsync({ id: definitionId, body: payload, idempotencyKey });
          else await create.mutateAsync({ body: payload, idempotencyKey });
          message.success(t('처리했어요'));
          setBody(null);
          navigate('/missions/definitions');
        }}
        onCancel={() => setBody(null)}
      />
    </>
  );
}

export default function MissionDefinitionFormPage() {
  const { definitionId } = useParams();
  const query = useDefinition(definitionId);

  return (
    <div style={{ maxWidth: 640 }}>
      <Typography.Title level={4}>
        {definitionId ? t('미션 틀 수정') : t('미션 틀 등록')}
      </Typography.Title>
      {definitionId ? (
        <QueryBoundary query={query}>
          {(definition) => <DefinitionForm definition={definition} />}
        </QueryBoundary>
      ) : (
        <DefinitionForm />
      )}
    </div>
  );
}
