// ADM-14 Mission definition create / edit
import { useEffect } from 'react';
import { Button, Form, Input, InputNumber, message, Select, Space, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router';
import QueryState from '../../../components/QueryState.jsx';
import confirmWithReason from '../confirmWithReason.jsx';
import { ADMIN_STATUS_OPTIONS, EXERCISE_OPTIONS, METHOD_OPTIONS } from '../constants.js';
import { useCatalog, useCreateDefinition, useDefinition, useUpdateDefinition } from '../queries.js';

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

export default function MissionDefinitionFormPage() {
  const { definitionId } = useParams();
  const isEdit = Boolean(definitionId);
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { data: definition, isLoading, error, refetch } = useDefinition(definitionId);
  const { data: categories = [] } = useCatalog('categories');
  const { data: difficulties = [] } = useCatalog('difficulties');
  const create = useCreateDefinition();
  const update = useUpdateDefinition();

  useEffect(() => {
    if (definition) form.setFieldsValue(definition);
  }, [definition, form]);

  const submit = (values) => {
    if (methodMismatch(values.exerciseCode, values.verificationMethod)) {
      message.error('달리기는 센서, 나머지 운동은 카메라 인증만 가능해요.');
      return;
    }
    const body = Object.fromEntries(
      FIELDS.filter(
        (key) => values[key] !== undefined && values[key] !== null && values[key] !== '',
      )
        .filter((key) => !isEdit || values[key] !== definition?.[key])
        .map((key) => [key, values[key]]),
    );
    if (isEdit && Object.keys(body).length === 0) {
      message.info('바꾼 항목이 없어요.');
      return;
    }
    confirmWithReason({
      title: isEdit ? '미션 정의를 수정할까요?' : '미션 정의를 등록할까요?',
      content: isEdit ? '이미 만들어진 미션에는 영향이 없어요.' : undefined,
      okText: isEdit ? '수정' : '등록',
      onOk: async (reason, idempotencyKey) => {
        const payload = { ...body, reason };
        if (isEdit) await update.mutateAsync({ id: definitionId, body: payload, idempotencyKey });
        else await create.mutateAsync({ body: payload, idempotencyKey });
        message.success('변경 사항을 저장했습니다.');
        navigate('/missions/definitions');
      },
    });
  };

  const options = (items) => items.map((item) => ({ value: item.id, label: item.name }));

  return (
    <div style={{ maxWidth: 640 }}>
      <Typography.Title level={4}>{isEdit ? '미션 정의 수정' : '미션 정의 등록'}</Typography.Title>
      <QueryState loading={isEdit && isLoading} error={isEdit ? error : null} onRetry={refetch}>
        <Form
          form={form}
          layout="vertical"
          onFinish={submit}
          initialValues={{ publicationStatus: 'public', verificationMethod: 'camera' }}
        >
          <Form.Item
            label="제목"
            name="title"
            rules={[
              { required: true, whitespace: true, message: '제목을 입력해 주세요.' },
              { max: 200, message: '200자 이하로 입력해 주세요.' },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="설명" name="description" rules={[{ max: 2000 }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Space align="start" wrap>
            <Form.Item
              label="분야"
              name="categoryId"
              rules={[{ required: true, message: '분야를 선택해 주세요.' }]}
            >
              <Select style={{ width: 200 }} options={options(categories)} />
            </Form.Item>
            <Form.Item
              label="난이도"
              name="difficultyId"
              rules={[{ required: true, message: '난이도를 선택해 주세요.' }]}
            >
              <Select style={{ width: 200 }} options={options(difficulties)} />
            </Form.Item>
          </Space>
          <Space align="start" wrap>
            <Form.Item label="운동 종류" name="exerciseCode">
              <Select allowClear style={{ width: 200 }} options={EXERCISE_OPTIONS} />
            </Form.Item>
            <Form.Item
              label="인증 방식"
              name="verificationMethod"
              rules={[{ required: true, message: '인증 방식을 선택해 주세요.' }]}
            >
              <Select style={{ width: 200 }} options={METHOD_OPTIONS} />
            </Form.Item>
          </Space>
          <Space align="start" wrap>
            <Form.Item label="목표 값" name="targetValue">
              <InputNumber min={0.01} max={99999999.99} />
            </Form.Item>
            <Form.Item label="목표 단위" name="targetUnit" rules={[{ max: 20 }]}>
              <Input style={{ width: 120 }} />
            </Form.Item>
            <Form.Item label="예상 소요 시간(초)" name="estimatedDurationSeconds">
              <InputNumber min={1} max={86400} precision={0} />
            </Form.Item>
          </Space>
          <Form.Item label="공개 상태" name="publicationStatus">
            <Select style={{ width: 200 }} options={ADMIN_STATUS_OPTIONS} />
          </Form.Item>
          <Space>
            <Button onClick={() => navigate('/missions/definitions')}>취소</Button>
            <Button type="primary" htmlType="submit">
              {isEdit ? '수정' : '등록'}
            </Button>
          </Space>
        </Form>
      </QueryState>
    </div>
  );
}
