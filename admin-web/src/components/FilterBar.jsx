import { useEffect, useState } from 'react';
import { Button, DatePicker, Input, Select, Space } from 'antd';
import dayjs from 'dayjs';

const DATE_FORMAT = 'YYYY-MM-DD'; // docs/05 §3: a `date` is YYYY-MM-DD (Asia/Seoul)

/**
 * Search, status and period filters with a "검색" and a "초기화" button.
 * `onChange(next)` is called with the value of every field when "검색" is pressed (or Enter in a
 * text field); a field without a value is ''. "초기화" calls it with all fields ''.
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
 */
export function FilterBar({ fields, value, onChange }) {
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
  const submit = () => onChange(collect(draft));
  const reset = () => {
    setDraft({});
    onChange(collect({}));
  };

  return (
    <Space wrap style={{ marginBottom: 16 }}>
      {fields.map((field) => {
        const label = field.label ?? field.name;
        if (field.type === 'select') {
          return (
            <Select
              key={field.name}
              allowClear
              style={{ minWidth: 140 }}
              placeholder={label}
              aria-label={label}
              options={field.options}
              value={draft[field.name] || undefined}
              onChange={(next) => setField({ [field.name]: next ?? '' })}
            />
          );
        }
        if (field.type === 'dateRange') {
          const range = [draft.from, draft.to].map((text) => (text ? dayjs(text) : null));
          return (
            <DatePicker.RangePicker
              key={field.name}
              value={range}
              onChange={(dates) =>
                setField({
                  from: dates?.[0] ? dates[0].format(DATE_FORMAT) : '',
                  to: dates?.[1] ? dates[1].format(DATE_FORMAT) : '',
                })
              }
            />
          );
        }
        return (
          <Input
            key={field.name}
            allowClear
            style={{ width: 220 }}
            placeholder={label}
            aria-label={label}
            value={draft[field.name] ?? ''}
            onChange={(event) => setField({ [field.name]: event.target.value })}
            onPressEnter={submit}
          />
        );
      })}
      <Button type="primary" onClick={submit}>
        검색
      </Button>
      <Button onClick={reset}>초기화</Button>
    </Space>
  );
}
