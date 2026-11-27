import Link from "next/link";
import { DotsThreeOutlineIcon, SignOutIcon } from "@phosphor-icons/react/dist/ssr";

import { BrandMark } from "@/components/brand/brand-mark";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import type { Branding } from "@/modules/branding";

import { BrandTokens } from "./brand-tokens";
import { bottomNavItems, type NavItem, type NavLabel } from "./nav-items";
import { BottomNavLink, SidebarLink } from "./nav-link";

type ShellProps = {
  branding: Branding;
  items: NavItem[];
  userName: string;
  roleLabel: string;
  organizationName: string;
  locale: Locale;
  t: Dictionary;
};

function navLabel(label: NavLabel, t: Dictionary): string {
  const labels: Record<NavLabel, string> = {
    home: t.shell.home,
    bookings: t.dashboard.bookingsLink,
    myFarm: t.dashboard.myFarmLink,
    myJobs: t.dashboard.myJobsLink,
    farmers: t.dashboard.farmersLink,
    map: t.maps.overviewLink,
    fleet: t.dashboard.fleetLink,
    slots: t.dashboard.slotsLink,
    territory: t.dashboard.territoryLink,
  };
  return labels[label];
}

function SignOutButton({
  label,
  compact = false,
  onDark = false,
}: {
  label: string;
  compact?: boolean;
  onDark?: boolean;
}) {
  return (
    <form action="/api/auth/signout" method="post">
      <button
        type="submit"
        aria-label={compact ? label : undefined}
        className={`flex min-h-11 items-center gap-2 rounded-xl font-semibold transition ${
          onDark
            ? "text-white/70 hover:bg-white/8 hover:text-white"
            : "text-ink-muted hover:bg-brand-soft hover:text-ink"
        } ${compact ? "w-11 justify-center" : "w-full px-3"}`}
      >
        <SignOutIcon weight="duotone" className="size-5 shrink-0" aria-hidden />
        {compact ? null : label}
      </button>
    </form>
  );
}

export function AppShell({
  branding,
  items,
  userName,
  roleLabel,
  organizationName,
  locale,
  t,
}: ShellProps) {
  const bottom = bottomNavItems(items);
  const overflow = items.slice(bottom.items.length);
  const href = (path: string) => withLocale(locale, path);
  const languages = (short: boolean) => (
    <LanguageSwitcher
      current={locale}
      onDark={!short}
      label={t.language.label}
      names={
        short
          ? { en: t.language.enShort, hi: t.language.hiShort }
          : { en: t.language.en, hi: t.language.hi }
      }
    />
  );

  return (
    <>
      <BrandTokens branding={branding} />

      {/* Desktop: fixed sidebar. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-forest text-white shadow-raised lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-soft">
            <BrandMark branding={branding} className="size-8" />
          </span>
          <span className="truncate text-xl font-extrabold tracking-tight">{branding.name}</span>
        </div>
        <nav aria-label={t.shell.navigation} className="flex-1 space-y-1 overflow-y-auto px-3">
          {items.map((item) => (
            <SidebarLink
              key={item.path}
              href={href(item.path)}
              label={navLabel(item.label, t)}
              icon={item.icon}
              exact={item.exact}
              onDark
            />
          ))}
        </nav>
        <div className="space-y-3 px-3 pt-3 pb-5">
          <div className="rounded-xl bg-white/8 px-3 py-2.5">
            <p className="truncate font-semibold">{userName}</p>
            <p className="truncate text-sm text-white/70">{roleLabel}</p>
            <p className="truncate text-sm text-white/70">{organizationName}</p>
          </div>
          {languages(false)}
          <SignOutButton label={t.shell.signOut} onDark />
        </div>
      </aside>

      {/* Phones and tablets: top bar. */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 bg-surface/95 px-4 shadow-soft backdrop-blur lg:hidden">
        <Link href={href("/dashboard")} className="flex min-w-0 items-center gap-2.5">
          <BrandMark branding={branding} className="size-9" />
          <span className="truncate text-lg font-extrabold tracking-tight text-brand">
            {branding.name}
          </span>
        </Link>
        <div className="flex items-center gap-1">
          {languages(true)}
          <SignOutButton label={t.shell.signOut} compact />
        </div>
      </header>

      {/* Phones and tablets: bottom navigation. */}
      <nav
        aria-label={t.shell.navigation}
        className="fixed inset-x-0 bottom-0 z-30 flex bg-surface px-1 pb-[env(safe-area-inset-bottom)] shadow-nav lg:hidden"
      >
        {bottom.items.map((item) => (
          <BottomNavLink
            key={item.path}
            href={href(item.path)}
            label={navLabel(item.label, t)}
            icon={item.icon}
            exact={item.exact}
          />
        ))}
        {bottom.more ? (
          <details className="group relative flex flex-1">
            <summary className="flex min-h-14 flex-1 cursor-pointer list-none flex-col items-center justify-center gap-0.5 text-xs font-semibold text-ink-muted [&::-webkit-details-marker]:hidden">
              <span className="flex h-7 w-12 items-center justify-center rounded-full group-open:bg-brand-soft group-open:text-brand">
                <DotsThreeOutlineIcon weight="fill" className="size-[22px]" aria-hidden />
              </span>
              {t.shell.more}
            </summary>
            <div className="absolute right-1 bottom-full mb-2 w-60 space-y-1 rounded-2xl bg-surface p-2 shadow-raised">
              {overflow.map((item) => (
                <SidebarLink
                  key={item.path}
                  href={href(item.path)}
                  label={navLabel(item.label, t)}
                  icon={item.icon}
                />
              ))}
            </div>
          </details>
        ) : null}
      </nav>
    </>
  );
}
