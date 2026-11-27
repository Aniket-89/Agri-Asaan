import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import {
  CaretRightIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  PhoneIcon,
  UserIcon,
  UserPlusIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr";

import {
  Badge,
  Button,
  buttonClass,
  EmptyState,
  Page,
  PageHeader,
  PageSkeleton,
} from "@/components/ui";

import { format, withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";
import { canPlaceFarmers, farmerSearchSchema, listFarmers } from "@/modules/farmers";
import { getActiveMembershipContext } from "@/modules/organizations";

export const instant = false;

const FARMER_LIST_LIMIT = 50;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.farmers.title };
}

async function FarmerList({
  searchParams,
  t,
  locale,
}: {
  searchParams: PageProps<"/[lang]/dashboard/farmers">["searchParams"];
  t: Dictionary["farmers"];
  locale: Locale;
}) {
  await connection();
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(withLocale(locale, "/login"));
  }

  const parsed = farmerSearchSchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data.q : undefined;
  const canPlace = canPlaceFarmers(context.role);
  const unplacedOnly = canPlace && parsed.success && parsed.data.show === "unplaced";
  const farmers = await listFarmers(context, query || undefined, unplacedOnly);
  if (!farmers) {
    notFound();
  }
  const listPath = withLocale(locale, "/dashboard/farmers");

  return (
    <>
      <Form action={listPath} className="flex gap-2" role="search">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{t.searchLabel}</span>
          <MagnifyingGlassIcon
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-faint"
            aria-hidden
          />
          <input
            name="q"
            type="search"
            defaultValue={query ?? ""}
            maxLength={60}
            placeholder={t.searchLabel}
            className="min-h-12 w-full rounded-xl bg-surface py-2.5 pr-4 pl-11 text-base text-ink shadow-soft placeholder:text-ink-faint focus:ring-3 focus:ring-leaf/70 focus:outline-none"
          />
        </label>
        {unplacedOnly ? <input type="hidden" name="show" value="unplaced" /> : null}
        <Button variant="secondary">{t.searchSubmit}</Button>
      </Form>

      {canPlace ? (
        <nav aria-label={t.filterLabel} className="flex flex-wrap gap-2">
          <Link
            href={listPath}
            aria-current={unplacedOnly ? undefined : "page"}
            className={buttonClass({ variant: unplacedOnly ? "quiet" : "secondary", size: "sm" })}
          >
            {t.filterAll}
          </Link>
          <Link
            href={`${listPath}?show=unplaced`}
            aria-current={unplacedOnly ? "page" : undefined}
            className={buttonClass({ variant: unplacedOnly ? "secondary" : "quiet", size: "sm" })}
          >
            {t.filterUnplaced}
          </Link>
        </nav>
      ) : null}

      {farmers.length === FARMER_LIST_LIMIT ? (
        <p className="text-sm text-ink-muted">
          {format(t.showingFirst, { count: FARMER_LIST_LIMIT })}
        </p>
      ) : null}

      {farmers.length === 0 ? (
        <EmptyState
          icon={<UsersThreeIcon weight="duotone" className="size-7" />}
          text={t.noResults}
        />
      ) : (
        <ul className="space-y-1 rounded-2xl bg-surface p-1.5 shadow-soft">
          {farmers.map((farmer) => (
            <li key={farmer.id}>
              <Link
                href={withLocale(locale, `/dashboard/farmers/${farmer.id}`)}
                className="flex min-h-16 items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-canvas"
              >
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sky-soft text-sky"
                >
                  <UserIcon weight="fill" className="size-5" />
                </span>
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold text-ink">{farmer.fullName}</span>
                    {farmer.isActive ? null : <Badge tone="neutral">{t.inactive}</Badge>}
                    {farmer.villageName ? null : (
                      <Badge tone="neutral">{farmer.hasRegion ? t.notPlaced : t.outsideArea}</Badge>
                    )}
                  </span>
                  <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
                    <span className="flex items-center gap-1.5">
                      <MapPinIcon weight="fill" className="size-4 text-ink-faint" aria-hidden />
                      {farmer.villageName ??
                        [farmer.locality, farmer.tehsilName, farmer.districtName]
                          .filter(Boolean)
                          .join(", ")}
                    </span>
                    <span className="flex items-center gap-1.5 tabular-nums">
                      <PhoneIcon weight="fill" className="size-4 text-ink-faint" aria-hidden />
                      {farmer.phone}
                    </span>
                  </span>
                </span>
                <CaretRightIcon className="size-5 shrink-0 text-ink-faint" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default async function FarmersPage({
  searchParams,
}: PageProps<"/[lang]/dashboard/farmers">) {
  const { locale, t } = await getDictionary();

  return (
    <Page>
      <PageHeader
        title={t.farmers.title}
        action={
          <Link href={withLocale(locale, "/dashboard/farmers/new")} className={buttonClass()}>
            <UserPlusIcon weight="bold" className="size-5" aria-hidden />
            {t.farmers.register}
          </Link>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <FarmerList searchParams={searchParams} t={t.farmers} locale={locale} />
      </Suspense>
    </Page>
  );
}
