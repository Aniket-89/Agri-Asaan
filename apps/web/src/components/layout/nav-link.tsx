"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardTextIcon,
  ClockIcon,
  DotsThreeOutlineIcon,
  DroneIcon,
  HouseIcon,
  ListChecksIcon,
  MapPinAreaIcon,
  MapTrifoldIcon,
  PlantIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";

import { stripLocale } from "@/lib/i18n/config";

const ICONS = {
  home: HouseIcon,
  bookings: ClipboardTextIcon,
  myFarm: PlantIcon,
  myJobs: ListChecksIcon,
  farmers: UsersThreeIcon,
  map: MapTrifoldIcon,
  fleet: DroneIcon,
  slots: ClockIcon,
  territory: MapPinAreaIcon,
  more: DotsThreeOutlineIcon,
} as const;

export type NavIcon = keyof typeof ICONS;

// Highlights the current section: exact match for Home, prefix match for the
// rest (so a booking's detail page keeps "Bookings" active).
function useIsActive(href: string, exact: boolean): boolean {
  const current = stripLocale(usePathname()).path;
  const target = stripLocale(href).path;
  return exact ? current === target : current === target || current.startsWith(`${target}/`);
}

export function SidebarLink({
  href,
  label,
  icon,
  exact = false,
  onDark = false,
}: {
  href: string;
  label: string;
  icon: NavIcon;
  exact?: boolean;
  // The desktop sidebar is forest green; the phone "More" menu is white.
  onDark?: boolean;
}) {
  const active = useIsActive(href, exact);
  const Icon = ICONS[icon];
  const look = onDark
    ? active
      ? "bg-white/12 text-white shadow-soft"
      : "text-white/70 hover:bg-white/8 hover:text-white"
    : active
      ? "bg-brand text-white shadow-soft"
      : "text-ink-muted hover:bg-brand-soft hover:text-ink";
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold transition ${look}`}
    >
      <Icon
        weight={active ? "fill" : "duotone"}
        className={`size-5 shrink-0 ${onDark && active ? "text-leaf" : ""}`}
        aria-hidden
      />
      {label}
    </Link>
  );
}

export function BottomNavLink({
  href,
  label,
  icon,
  exact = false,
}: {
  href: string;
  label: string;
  icon: NavIcon;
  exact?: boolean;
}) {
  const active = useIsActive(href, exact);
  const Icon = ICONS[icon];
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition ${
        active ? "text-brand" : "text-ink-muted"
      }`}
    >
      <span
        className={`flex h-7 w-12 items-center justify-center rounded-full transition ${
          active ? "bg-brand-soft" : ""
        }`}
      >
        <Icon weight={active ? "fill" : "duotone"} className="size-[22px]" aria-hidden />
      </span>
      <span className="max-w-full truncate px-1">{label}</span>
    </Link>
  );
}
