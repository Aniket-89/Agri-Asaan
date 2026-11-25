// Link-based tabs, so they work without JavaScript. The active tab is a raised
// white chip on a sunken track.
export function SegmentedTabs({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string; count?: number; active: boolean }[];
}) {
  return (
    <nav
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-field p-1 shadow-inset"
    >
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-center text-sm font-semibold transition ${
            item.active ? "bg-surface text-brand shadow-soft" : "text-ink-muted hover:text-ink"
          }`}
        >
          {item.label}
          {item.count !== undefined ? (
            <span
              className={`min-w-6 rounded-full px-1.5 text-xs leading-5 ${
                item.active ? "bg-brand text-white" : "bg-surface/70 text-ink-muted"
              }`}
            >
              {item.count}
            </span>
          ) : null}
        </a>
      ))}
    </nav>
  );
}
