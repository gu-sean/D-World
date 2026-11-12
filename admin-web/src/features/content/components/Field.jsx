/** A label above a form control (the control itself carries the accessible name). */
export function Field({ label, hint, children }) {
  return (
    <div>
      <div style={{ marginBottom: 4 }}>{label}</div>
      {children}
      {hint && <div style={{ marginTop: 4, color: '#8c8c8c' }}>{hint}</div>}
    </div>
  );
}
