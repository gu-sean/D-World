/**
 * Shows a value that the server has already masked, exactly as it came.
 * The web never unmasks or re-formats it (and has no way to).
 * @param {object} props
 * @param {string|null} [props.value]
 */
export function MaskedText({ value }) {
  return <span>{value ?? '-'}</span>;
}
