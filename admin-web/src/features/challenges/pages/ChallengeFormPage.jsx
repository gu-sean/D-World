// ADM-19 Official challenge create / edit
import { useEffect, useMemo } from 'react';
import { App, Button, DatePicker, Form, Input, InputNumber, Select, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router';
import QueryState from '../../../components/QueryState.jsx';
import { EXERCISE, VERIFICATION_METHOD } from '../labels.js';
import {
  useCategories,
  useChallenge,
  useCreateChallenge,
  useDifficultyLevels,
  useUpdateChallenge,
} from '../queries.js';

const DURATIONS = [7, 14, 30];
const DATE_FORMAT = 'YYYY-MM-DD';
const REASON_RULES = [
  { required: true, whitespace: true, message: '사유를 입력해 주세요.' },
  { max: 500, message: '사유는 500자까지 입력할 수 있어요.' },
];

const toFormValues = (c) => ({
  title: c.title,
  description: c.description,
  categoryId: c.categoryId,
  difficultyId: c.difficultyId,
  verificationMethod: c.verificationMethod,
  exerciseCode: c.exerciseCode ?? undefined,
  targetValue: c.targetValue ?? undefined,
  targetUnit: c.targetUnit ?? undefined,
  estimatedDurationSeconds: c.estimatedDurationSeconds ?? undefined,
  period: [dayjs(c.startDate), dayjs(c.endDate)],
  requiredSuccessDays: c.requiredSuccessDays ?? undefined,
  maxParticipants: c.maxParticipants ?? undefined,
  reward: { ...c.reward },
});

/** form values -> request fields (blank optional fields are left out) */
const toBody = (values) => {
  const { period, reason, ...rest } = values;
  const body = {
    ...rest,
    startDate: period[0].format(DATE_FORMAT),
    endDate: period[1].format(DATE_FORMAT),
  };
  const blank = (value) => value === undefined || value === null || value === '';
  for (const key of Object.keys(body)) if (blank(body[key])) delete body[key];
  if (body.reward) {
    body.reward = Object.fromEntries(Object.entries(body.reward).filter(([, v]) => !blank(v)));
  }
  return { body, reason };
};

export default function ChallengeFormPage() {
  const { challengeId } = useParams();
  const isEdit = Boolean(challengeId);
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const categories = useCategories();
  const difficulties = useDifficultyLevels();
  const challenge = useChallenge(challengeId);
  const create = useCreateChallenge();
  const update = useUpdateChallenge();
  const saving = create.isPending || update.isPending;
  const saveError = create.error ?? update.error;

  const initial = useMemo(
    () => (challenge.data ? toFormValues(challenge.data) : null),
    [challenge.data],
  );
  useEffect(() => {
    if (initial) form.setFieldsValue(initial);
  }, [initial, form]);

  const loading = categories.isLoading || difficulties.isLoading || (isEdit && challenge.isLoading);
  const loadError = categories.error ?? difficulties.error ?? (isEdit ? challenge.error : null);

  const onFinish = async (values) => {
    const { body, reason } = toBody(values);
    try {
      if (isEdit) {
        const original = toBody({ ...initial, reason }).body;
        const patch = Object.fromEntries(
          Object.entries(body).filter(
            ([key, value]) => JSON.stringify(value) !== JSON.stringify(original[key]),
          ),
        );
        if (Object.keys(patch).length === 0) {
          message.info('바꾼 항목이 없어요.');
          return;
        }
        await update.mutateAsync({ id: challengeId, patch: { ...patch, reason } });
      } else {
        await create.mutateAsync({ body: { ...body, reason } });
      }
      message.success('변경 사항을 저장했습니다.');
      navigate('/challenges');
    } catch {
      // The error is shown under the form (saveError); the typed values stay.
    }
  };

  const validatePeriod = (_, value) => {
    if (!value) return Promise.reject(new Error('기간을 선택해 주세요.'));
    const days = value[1].diff(value[0], 'day') + 1;
    return DURATIONS.includes(days)
      ? Promise.resolve()
      : Promise.reject(new Error('기간은 7일·14일·30일 중 하나여야 해요. (시작·종료일 포함)'));
  };

  return (
    <QueryState loading={loading} error={loadError}>
      <Typography.Title level={4}>
        {isEdit ? '공식 챌린지 수정' : '공식 챌린지 등록'}
      </Typography.Title>
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 720 }}
        onFinish={onFinish}
        initialValues={{ reward: { points: 0, userXp: 0, petXp: 0 } }}
      >
        <Form.Item
          label="제목"
          name="title"
          rules={[
            { required: true, whitespace: true, message: '제목을 입력해 주세요.' },
            { max: 200 },
          ]}
        >
          <Input maxLength={200} />
        </Form.Item>
        <Form.Item
          label="설명"
          name="description"
          rules={[
            { required: true, whitespace: true, message: '설명을 입력해 주세요.' },
            { max: 5000 },
          ]}
        >
          <Input.TextArea rows={4} maxLength={5000} />
        </Form.Item>
        <Space align="start" wrap>
          <Form.Item
            label="분야"
            name="categoryId"
            rules={[{ required: true, message: '분야를 선택해 주세요.' }]}
          >
            <Select
              style={{ width: 200 }}
              options={(categories.data ?? [])
                .filter((c) => c.isActive)
                .map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
          <Form.Item
            label="난이도"
            name="difficultyId"
            rules={[{ required: true, message: '난이도를 선택해 주세요.' }]}
          >
            <Select
              style={{ width: 200 }}
              options={(difficulties.data ?? [])
                .filter((d) => d.isActive)
                .map((d) => ({ value: d.id, label: d.name }))}
            />
          </Form.Item>
        </Space>
        <Space align="start" wrap>
          <Form.Item
            label="인증 방식"
            name="verificationMethod"
            rules={[{ required: true, message: '인증 방식을 선택해 주세요.' }]}
          >
            <Select
              style={{ width: 200 }}
              options={Object.entries(VERIFICATION_METHOD).map(([value, text]) => ({
                value,
                label: text,
              }))}
            />
          </Form.Item>
          <Form.Item
            label="운동 종류"
            name="exerciseCode"
            dependencies={['verificationMethod']}
            rules={[
              ({ getFieldValue }) => ({
                validator: (_, value) =>
                  !value ||
                  (value === 'running') === (getFieldValue('verificationMethod') === 'sensor')
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error('달리기는 센서, 나머지 운동은 카메라 인증만 가능해요.'),
                      ),
              }),
            ]}
          >
            <Select
              allowClear
              style={{ width: 200 }}
              options={Object.entries(EXERCISE).map(([value, text]) => ({ value, label: text }))}
            />
          </Form.Item>
        </Space>
        <Space align="start" wrap>
          <Form.Item label="목표 값" name="targetValue">
            <InputNumber min={0.01} max={99999999} style={{ width: 140 }} />
          </Form.Item>
          <Form.Item label="목표 단위" name="targetUnit" rules={[{ max: 20 }]}>
            <Input maxLength={20} style={{ width: 140 }} />
          </Form.Item>
          <Form.Item label="예상 소요(초)" name="estimatedDurationSeconds">
            <InputNumber min={1} max={86400} precision={0} style={{ width: 140 }} />
          </Form.Item>
        </Space>
        <Form.Item label="챌린지 기간" name="period" rules={[{ validator: validatePeriod }]}>
          <DatePicker.RangePicker />
        </Form.Item>
        <Space align="start" wrap>
          <Form.Item
            label="완주 필요 일수"
            name="requiredSuccessDays"
            dependencies={['period']}
            rules={[
              ({ getFieldValue }) => ({
                validator: (_, value) => {
                  const period = getFieldValue('period');
                  if (!value || !period) return Promise.resolve();
                  return value <= period[1].diff(period[0], 'day') + 1
                    ? Promise.resolve()
                    : Promise.reject(new Error('완주 필요 일수는 기간 일수를 넘을 수 없어요.'));
                },
              }),
            ]}
          >
            <InputNumber min={1} max={30} precision={0} style={{ width: 160 }} />
          </Form.Item>
          <Form.Item label="최대 참가자" name="maxParticipants">
            <InputNumber min={1} max={1000000} precision={0} style={{ width: 160 }} />
          </Form.Item>
        </Space>
        <Typography.Title level={5}>완주 보상</Typography.Title>
        <Space align="start" wrap>
          <Form.Item
            label="포인트"
            name={['reward', 'points']}
            rules={[{ required: true, message: '필수' }]}
          >
            <InputNumber min={0} max={1000000} precision={0} />
          </Form.Item>
          <Form.Item
            label="사용자 경험치"
            name={['reward', 'userXp']}
            rules={[{ required: true, message: '필수' }]}
          >
            <InputNumber min={0} max={1000000} precision={0} />
          </Form.Item>
          <Form.Item
            label="펫 경험치"
            name={['reward', 'petXp']}
            rules={[{ required: true, message: '필수' }]}
          >
            <InputNumber min={0} max={1000000} precision={0} />
          </Form.Item>
        </Space>
        <Form.Item label="배지 업적 버전 ID (선택)" name={['reward', 'badgeAchievementVersionId']}>
          <Input placeholder="UUID" />
        </Form.Item>
        <Form.Item label="변경 사유" name="reason" rules={REASON_RULES}>
          <Input.TextArea rows={2} maxLength={500} showCount />
        </Form.Item>
        {saveError && (
          <Typography.Paragraph type="danger" role="alert">
            {saveError.message}
          </Typography.Paragraph>
        )}
        <Space>
          <Button onClick={() => navigate('/challenges')}>취소</Button>
          <Button type="primary" htmlType="submit" loading={saving}>
            저장
          </Button>
        </Space>
      </Form>
    </QueryState>
  );
}
