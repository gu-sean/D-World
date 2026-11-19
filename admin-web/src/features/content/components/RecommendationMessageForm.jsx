import { useState } from 'react';
import { Alert, Button, Card, Input, Radio, Switch } from 'antd';
import { useCreateRecommendationMessage, useUpdateRecommendationMessage } from '../queries.js';
import { fromInputValue, toInputValue } from '../time.js';
import { Field } from './Field.jsx';
import { formStyle } from './formStyle.js';
import { WEEKDAYS } from '../weekdays.js';
import { t } from '../../../i18n/index.js';

const MESSAGE_MAX_LENGTH = 200; // docs/07 RecommendationMessageAdmin
// 라디오 값은 문자열: 'all' = 매일(요일 없음), '1'~'7' = 월~일
const weekdayOptions = [
  { value: 'all', label: t('매일') },
  ...WEEKDAYS.map((day) => ({ value: String(day.value), label: day.label })),
];

function initialState(item) {
  return {
    message: item?.message ?? '',
    weekday: item?.weekday == null ? 'all' : String(item.weekday),
    categoryCode: item?.categoryCode ?? '',
    startsAt: toInputValue(item?.startsAt),
    endsAt: toInputValue(item?.endsAt),
    isActive: item?.isActive ?? true,
  };
}

function validate(form) {
  if (!form.message.trim()) return t('문구를 입력해 주세요.');
  if (form.startsAt && form.endsAt && form.endsAt <= form.startsAt) {
    return t('종료 시각은 시작 시각 이후여야 해요.');
  }
  return null;
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
      weekday: form.weekday === 'all' ? null : Number(form.weekday),
      categoryCode: form.categoryCode.trim() || null,
      startsAt: fromInputValue(form.startsAt),
      endsAt: fromInputValue(form.endsAt),
      isActive: form.isActive,
    };
    onConfirm({
      title: item ? t('추천 문구 수정') : t('추천 문구 저장'),
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
    <Card title={item ? t('추천 문구 수정') : t('추천 문구 만들기')}>
      <div style={formStyle}>
        <Field label={t('문구')}>
          <Input.TextArea
            aria-label={t('문구')}
            rows={3}
            maxLength={MESSAGE_MAX_LENGTH}
            showCount
            value={form.message}
            onChange={(event) => set({ message: event.target.value })}
          />
        </Field>
        <Field
          label={t('보여줄 요일')}
          hint={t(
            '홈 화면은 오늘 요일의 문구를 보여줘요. 같은 요일에 여러 개면 날마다 하나씩 골라요.',
          )}
        >
          <Radio.Group
            value={form.weekday}
            onChange={(event) => set({ weekday: event.target.value })}
            options={weekdayOptions}
          />
        </Field>
        <Field label={t('분야 코드 (선택)')}>
          <Input
            aria-label={t('분야 코드')}
            style={{ maxWidth: 240 }}
            value={form.categoryCode}
            onChange={(event) => set({ categoryCode: event.target.value })}
          />
        </Field>
        <Field label={t('시작 시각 (선택, 한국 시간)')}>
          <Input
            type="datetime-local"
            aria-label={t('시작 시각 (기간)')}
            style={{ maxWidth: 240 }}
            value={form.startsAt}
            onChange={(event) => set({ startsAt: event.target.value })}
          />
        </Field>
        <Field label={t('종료 시각 (선택, 한국 시간)')}>
          <Input
            type="datetime-local"
            aria-label={t('종료 시각 (기간)')}
            style={{ maxWidth: 240 }}
            value={form.endsAt}
            onChange={(event) => set({ endsAt: event.target.value })}
          />
        </Field>
        <Field label={t('사용')}>
          <Switch
            aria-label={t('사용')}
            checked={form.isActive}
            onChange={(checked) => set({ isActive: checked })}
          />
        </Field>
        {error && <Alert type="warning" showIcon title={error} />}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" onClick={handleSave}>
            {t('저장')}
          </Button>
          <Button onClick={onClose}>{t('닫기')}</Button>
        </div>
      </div>
    </Card>
  );
}
