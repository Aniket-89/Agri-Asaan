import Link from "next/link";
// Filter links: one scrolling row on phones, wrapping on wider screens.
export function FilterChips({
  label,
  items,
}: {
  label: string;
  items: { key: string; href: string; label: string; active: boolean }[];
}) {
  return (
    <nav
      aria-label={label}
      className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              scroll={false}
              aria-current={item.active ? "page" : undefined}
              className={`flex min-h-10 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap transition ${
                item.active
                  ? "bg-brand text-white shadow-soft"
                  : "bg-surface text-ink-muted shadow-soft hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
