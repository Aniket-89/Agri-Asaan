import type { ReactNode } from "react";

// An empty list is a prompt to act: an icon, one sentence, an optional action.
export function EmptyState({
  icon,
  text,
  action,
}: {
  icon: ReactNode;
  text: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface px-6 py-10 text-center shadow-soft">
      <span className="flex size-14 items-center justify-center rounded-full bg-brand-soft text-brand">
        {icon}
      </span>
      <p className="max-w-sm text-ink-muted">{text}</p>
      {action}
    </div>
  );
}
