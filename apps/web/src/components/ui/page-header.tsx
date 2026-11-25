import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {description ? <p className="max-w-prose text-ink-muted">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}
