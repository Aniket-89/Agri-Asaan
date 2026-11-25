import type { ReactNode } from "react";

// A white surface lifted off the canvas by a soft shadow. The title can carry
// an icon; an action sits to its right.
export function Panel({
  title,
  icon,
  action,
  children,
  className = "",
  id,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = title && id ? `${id}-heading` : undefined;
  return (
    <section
      aria-labelledby={headingId}
      className={`rounded-2xl bg-surface p-4 shadow-soft sm:p-5 ${className}`}
    >
      {title ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id={headingId} className="flex items-center gap-2 text-lg font-bold text-ink">
            {icon ? <span className="text-brand">{icon}</span> : null}
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
