import type { ReactNode } from "react";

// Filled controls instead of outlined boxes: a sage fill with a soft inset
// shadow, turning white with an accent ring on focus.
export const controlClass =
  "min-h-12 w-full rounded-xl bg-field px-4 py-2.5 text-base text-ink shadow-inset placeholder:text-ink-faint focus:bg-surface focus:outline-none focus:ring-3 focus:ring-leaf/70 disabled:opacity-60";

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-sm text-ink-muted">{hint}</span> : null}
    </label>
  );
}

// The same control on a tinted (canvas) background, where a sage fill would
// disappear: white fill instead.
export const controlOnTintClass = controlClass.replace("bg-field", "bg-surface");
