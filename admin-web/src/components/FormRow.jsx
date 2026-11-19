/** A row of form fields that share the width equally and wrap on narrow screens. */
export function FormRow({ children, min = 220 }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
        columnGap: 16,
      }}
    >
      {children}
    </div>
  );
}
