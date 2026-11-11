import { Input } from 'antd';

const INVALID_JSON_TEXT = '입력한 내용을 다시 확인해 주세요.'; // COMMON_VALIDATION_FAILED, docs/05 §7

// Returns the parsed value, or `undefined` when `text` is empty or not valid JSON.
const parse = (text) => {
  if (!text || !text.trim()) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/**
 * Editor of a JSON text (the `rules` of the verification criteria, ADM-10): an antd
 * `Input.TextArea` that checks that the text parses as JSON.
 *
 * The value is the TEXT. `onChange(text, parsed)` gives the new text and the parsed value, which
 * is `undefined` while the text is empty or not valid JSON, so the page can keep its "save"
 * button disabled with `parsed === undefined`. The server still checks the content of the rules.
 *
 * @param {object} props
 * @param {string} props.value
 * @param {(text: string, parsed: unknown) => void} props.onChange
 * @param {string} [props.error] error text from the page or the server, shown under the field
 */
export function JsonEditor({ value, onChange, error }) {
  const isBroken = Boolean(value?.trim()) && parse(value) === undefined;
  const message = isBroken ? INVALID_JSON_TEXT : error;

  return (
    <div>
      <Input.TextArea
        rows={16}
        spellCheck={false}
        style={{ fontFamily: 'monospace' }}
        status={message ? 'error' : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value, parse(event.target.value))}
      />
      {message && (
        <div role="alert" style={{ color: '#ff4d4f', marginTop: 4 }}>
          {message}
        </div>
      )}
    </div>
  );
}
