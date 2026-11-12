import { useState } from 'react';
import { Alert, Button, Card, Input, InputNumber, Radio, Switch } from 'antd';
import { labels } from '../../../constants/labels.js';
import { useCreateRecommendationMessage, useUpdateRecommendationMessage } from '../queries.js';
import { fromInputValue, toInputValue } from '../time.js';
import { Field } from './Field.jsx';
import { formStyle } from './formStyle.js';

const MESSAGE_MAX_LENGTH = 200; // docs/07 RecommendationMessageAdmin
const conditionOptions = Object.entries(labels.recommendationConditionType).map(
  ([value, { text }]) => ({ value, label: text }),
);

function initialState(item) {
  const params = item?.conditionParams ?? {};
  return {
    message: item?.message ?? '',
    conditionType: item?.conditionType ?? 'always',
    days: params.days ?? null,
    startHour: params.startHour ?? null,
    endHour: params.endHour ?? null,
    categoryCode: item?.categoryCode ?? '',
    priority: item?.priority ?? 50,
    startsAt: toInputValue(item?.startsAt),
    endsAt: toInputValue(item?.endsAt),
    isActive: item?.isActive ?? true,
  };
}

const isHour = (value) => Number.isInteger(value) && value >= 0 && value <= 23;

function validate(form) {
  if (!form.message.trim()) return '문구를 입력해 주세요.';
  if (form.conditionType === 'inactive_days') {
    if (!Number.isInteger(form.days) || form.days < 1 || form.days > 365) {
      return '미접속 일수를 1~365 사이의 정수로 입력해 주세요.';
    }
  }
  if (form.conditionType === 'time_slot') {
    if (!isHour(form.startHour) || !isHour(form.endHour)) {
      return '시작·종료 시각을 0~23 사이의 정수로 입력해 주세요.';
    }
    if (form.startHour === form.endHour) return '시작 시각과 종료 시각은 같을 수 없어요.';
  }
  if (!Number.isInteger(form.priority) || form.priority < 0 || form.priority > 100) {
    return '우선순위를 0~100 사이의 정수로 입력해 주세요.';
  }
  if (form.startsAt && form.endsAt && form.endsAt <= form.startsAt) {
    return '종료 시각은 시작 시각 이후여야 해요.';
  }
  return null;
}

function conditionParamsOf(form) {
  if (form.conditionType === 'inactive_days') return { days: form.days };
  if (form.conditionType === 'time_slot') {
    return { startHour: form.startHour, endHour: form.endHour };
  }
  return {};
}

/**
 * The form that makes a recommendation message (M99) or edits one (M100). The reason of the audit
 * log is asked by the confirm step of the page (`onConfirm`).
 * @param {object} props
 * @param {object} [props.item] the message to edit; without it a new one is made
 * @param {(request: object) => void} props.onConfirm
 * @param {() => void} props.onClose
 */
export function RecommendationMessageForm({ item, onConfirm, onClose }) {
  const create = useCreateRecommendationMessage();
  const update = useUpdateRecommendationMessage();
  const [form, setForm] = useState(() => initialState(item));
  const [error, setError] = useState(null);

  const set = (patch) => {
    setForm((current) => ({ ...current, ...patch }));
    setError(null);
  };

  const handleSave = () => {
    const problem = validate(form);
    if (problem) {
      setError(problem);
      return;
    }
    const input = {
      message: form.message.trim(),
      conditionType: form.conditionType,
      conditionParams: conditionParamsOf(form),
      categoryCode: form.categoryCode.trim() || null,
      priority: form.priority,
      startsAt: fromInputValue(form.startsAt),
      endsAt: fromInputValue(form.endsAt),
      isActive: form.isActive,
    };
    onConfirm({
      title: item ? '추천 문구 수정' : '추천 문구 저장',
      summary: input.message,
      submit: async ({ reason, idempotencyKey }) => {
        const body = { ...input, reason };
        if (item) await update.mutateAsync({ messageId: item.id, body, idempotencyKey });
        else await create.mutateAsync({ body, idempotencyKey });
        onClose();
      },
    });
  };

  return (
    <Card title={item ? '추천 문구 수정' : '추천 문구 만들기'}>
      <div style={formStyle}>
        <Field label="문구">
          <Input.TextArea
            aria-label="문구"
            rows={3}
            maxLength={MESSAGE_MAX_LENGTH}
            showCount
            value={form.message}
            onChange={(event) => set({ message: event.target.value })}
          />
        </Field>
        <Field label="보여줄 조건">
          <Radio.Group
            value={form.conditionType}
            onChange={(event) => set({ conditionType: event.target.value })}
            options={conditionOptions}
          />
        </Field>
        {form.conditionType === 'inactive_days' && (
          <Field label="미접속 일수 (1~365)">
            <InputNumber
              aria-label="미접속 일수"
              min={1}
              max={365}
              precision={0}
              value={form.days}
              onChange={(value) => set({ days: value })}
            />
          </Field>
        )}
        {form.conditionType === 'time_slot' && (
          <Field label="시간대 (0~23시, 한국 시간)">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <InputNumber
                aria-label="시작 시각"
                min={0}
                max={23}
                precision={0}
                value={form.startHour}
                onChange={(value) => set({ startHour: value })}
              />
              <span>~</span>
              <InputNumber
                aria-label="종료 시각"
                min={0}
                max={23}
                precision={0}
                value={form.endHour}
                onChange={(value) => set({ endHour: value })}
              />
            </div>
          </Field>
        )}
        <Field label="분야 코드 (선택)">
          <Input
            aria-label="분야 코드"
            style={{ maxWidth: 240 }}
            value={form.categoryCode}
            onChange={(event) => set({ categoryCode: event.target.value })}
          />
        </Field>
        <Field label="우선순위 (0~100)" hint="숫자가 클수록 먼저 보여줘요.">
          <InputNumber
            aria-label="우선순위"
            min={0}
            max={100}
            precision={0}
            value={form.priority}
            onChange={(value) => set({ priority: value })}
          />
        </Field>
        <Field label="시작 시각 (선택, 한국 시간)">
          <Input
            type="datetime-local"
            aria-label="시작 시각 (기간)"
            style={{ maxWidth: 240 }}
            value={form.startsAt}
            onChange={(event) => set({ startsAt: event.target.value })}
          />
        </Field>
        <Field label="종료 시각 (선택, 한국 시간)">
          <Input
            type="datetime-local"
            aria-label="종료 시각 (기간)"
            style={{ maxWidth: 240 }}
            value={form.endsAt}
            onChange={(event) => set({ endsAt: event.target.value })}
          />
        </Field>
        <Field label="사용">
          <Switch
            aria-label="사용"
            checked={form.isActive}
            onChange={(checked) => set({ isActive: checked })}
          />
        </Field>
        {error && <Alert type="warning" showIcon title={error} />}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" onClick={handleSave}>
            저장
          </Button>
          <Button onClick={onClose}>닫기</Button>
        </div>
      </div>
    </Card>
  );
}
