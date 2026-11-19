import { useEffect, useState } from 'react';
import { Button, DatePicker, Input, Select, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import { t } from '../i18n/index.js';

const DATE_FORMAT = 'YYYY-MM-DD'; // docs/05 §3: a `date` is YYYY-MM-DD (Asia/Seoul)

/**
 * Search, status and period filters with a "초기화" button.
 * `onChange(next)` is called with the value of every field; a field without a value is ''.
 * Select and period fields apply as soon as they change. A text field has its own "검색" button
 * next to it (or Enter) and applies when that is used or when the text is cleared.
 * "초기화" calls it with all fields ''.
 * It fits `useListParams` directly (`setParams` removes the keys whose value is ''):
 * `<FilterBar fields={fields} value={params} onChange={setParams} />`
 *
 * - `text`: `value[name]` is the trimmed text.
 * - `select`: `value[name]` is the chosen `options[].value`.
 * - `dateRange`: the keys are always `from` and `to` (`YYYY-MM-DD`, both included, docs/05 §3);
 *   `name` is only the label key.
 *
 * @param {object} props
 * @param {{name: string, type: 'text'|'select'|'dateRange', label?: string,
 *   options?: {value: string, label: string}[]}[]} props.fields `label` is the placeholder
 *   (default: `name`)
 * @param {Record<string, any>} props.value current filter values
 * @param {(next: Record<string, string>) => void} props.onChange
 * @param {import('react').ReactNode} [props.extra] a button for the same row (e.g. "새 버전 추가"), lined up with "초기화"
 * @param {boolean} [props.compact] no space below (when the bar sits inside a row of other controls)
 */
export function FilterBar({ fields, value, onChange, compact = false, extra = null }) {
  const [draft, setDraft] = useState(value ?? {});

  // Take over changes that come from outside (reset, back button) but not from re-renders.
  const valueKey = JSON.stringify(value ?? {});
  useEffect(() => {
    setDraft(JSON.parse(valueKey));
  }, [valueKey]);

  const setField = (patch) => setDraft((current) => ({ ...current, ...patch }));

  const collect = (source) => {
    const next = {};
    for (const field of fields) {
      if (field.type === 'dateRange') {
        next.from = source.from ?? '';
        next.to = source.to ?? '';
      } else if (field.type === 'text') {
        next[field.name] = (source[field.name] ?? '').trim();
      } else {
        next[field.name] = source[field.name] ?? '';
      }
    }
    return next;
  };
  const submit = (patch = {}) => onChange(collect({ ...draft, ...patch }));
  const reset = () => {
    setDraft({});
    onChange(collect({}));
  };

  // Every field has a small label above it, so the chosen value never hides what it filters.
  const labelled = (field, label, control) => (
    <div key={field.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Typography.Text>
      {control}
    </div>
  );

  return (
    <Space
      wrap
      align="end"
      size={[12, 12]}
      style={{ display: 'flex', marginBottom: compact ? 0 : 16 }}
    >
      {fields.map((field) => {
        const label = field.label ?? (field.type === 'dateRange' ? t('기간') : field.name);
        if (field.type === 'select') {
          return labelled(
            field,
            label,
            <Select
              allowClear
              style={{ minWidth: 140 }}
              placeholder={t('전체')}
              aria-label={label}
              options={field.options}
              value={draft[field.name] || undefined}
              onChange={(next) => {
                setField({ [field.name]: next ?? '' });
                submit({ [field.name]: next ?? '' });
              }}
            />,
          );
        }
        if (field.type === 'dateRange') {
          const range = [draft.from, draft.to].map((text) => (text ? dayjs(text) : null));
          return labelled(
            field,
            label,
            <DatePicker.RangePicker
              value={range}
              onChange={(dates) => {
                const patch = {
                  from: dates?.[0] ? dates[0].format(DATE_FORMAT) : '',
                  to: dates?.[1] ? dates[1].format(DATE_FORMAT) : '',
                };
                setField(patch);
                submit(patch);
              }}
            />,
          );
        }
        return labelled(
          field,
          label,
          <Input.Search
            allowClear
            enterButton={t('검색')}
            style={{ width: field.width ?? 300 }}
            placeholder={t('검색어를 입력하세요')}
            aria-label={label}
            value={draft[field.name] ?? ''}
            onChange={(event) => {
              setField({ [field.name]: event.target.value });
              // the clear (x) button applies right away
              if (event.target.value === '' && event.type === 'click') {
                submit({ [field.name]: '' });
              }
            }}
            onSearch={() => submit()}
          />,
        );
      })}
      <Button onClick={reset}>{t('초기화')}</Button>
      {extra}
    </Space>
  );
}
