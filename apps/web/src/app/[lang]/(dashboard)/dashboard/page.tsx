import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import {
  ClipboardTextIcon,
  ClockIcon,
  DroneIcon,
  ListChecksIcon,
  MapPinAreaIcon,
  MapTrifoldIcon,
  PlantIcon,
  PlusIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr";

import { navItemsForRole, type NavLabel } from "@/components/layout/nav-items";
import {
  Button,
  buttonClass,
  controlClass,
  Field,
  Page,
  Panel,
  PageSkeleton,
} from "@/components/ui";
import { format, withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";
import {
  canUseBookingInbox,
  countByStatus,
  getOwnFarmerId,
  listBookings,
  listFarmerBookings,
  listMyJobs,
  OPEN_BOOKING_STATUSES,
} from "@/modules/bookings";
import { listFieldHealth, loadPixelCells } from "@/modules/crop-monitoring";
import { CropHealthCard } from "@/modules/crop-monitoring/components/crop-health-card";
import { listFarmerFields } from "@/modules/fields";
import { resolveActiveOrganization, type ActiveMembershipContext } from "@/modules/organizations";

export const instant = false;

type ShortcutLabel = Exclude<NavLabel, "home">;

// Each section gets its own farm tone so the grid reads at a glance instead
// of as a stack of identical cards.
const SHORTCUTS: Record<ShortcutLabel, { icon: typeof PlantIcon; tone: string }> = {
  bookings: { icon: ClipboardTextIcon, tone: "bg-sun-soft text-sun-ink" },
  myJobs: { icon: ListChecksIcon, tone: "bg-leaf-soft text-leaf-ink" },
  myFarm: { icon: PlantIcon, tone: "bg-leaf-soft text-leaf-ink" },
  farmers: { icon: UsersThreeIcon, tone: "bg-sky-soft text-sky" },
  map: { icon: MapTrifoldIcon, tone: "bg-brand-soft text-brand" },
  fleet: { icon: DroneIcon, tone: "bg-soil-soft text-soil" },
  slots: { icon: ClockIcon, tone: "bg-sun-soft text-sun-ink" },
  territory: { icon: MapPinAreaIcon, tone: "bg-sky-soft text-sky" },
};

function shortcutLabel(label: ShortcutLabel, t: Dictionary): string {
  const labels: Record<ShortcutLabel, string> = {
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

type Stat = { label: string; value: number; href: string };

// The few numbers each role acts on, each linking to the matching list.
async function loadStats(
  context: ActiveMembershipContext,
  locale: Locale,
  t: Dictionary
): Promise<Stat[]> {
  const href = (path: string) => withLocale(locale, path);
  const s = t.dashboard.stats;

  if (canUseBookingInbox(context.role)) {
    const counts = countByStatus((await listBookings(context)) ?? []);
    return (["requested", "confirmed", "completed"] as const).map((status) => ({
      label: s[status],
      value: counts[status],
      href: href(`/dashboard/bookings?status=${status}`),
    }));
  }
  if (context.role === "pilot") {
    const jobs = await listMyJobs(context, locale);
    if (!jobs) {
      return [];
    }
    return [
      { label: s.today, value: jobs.today.length, href: href("/dashboard/my-jobs?tab=today") },
      {
        label: s.upcoming,
        value: jobs.upcoming.length,
        href: href("/dashboard/my-jobs?tab=upcoming"),
      },
      {
        label: s.done,
        value: jobs.completed.length,
        href: href("/dashboard/my-jobs?tab=completed"),
      },
    ];
  }
  if (context.role === "farmer") {
    const farmerId = await getOwnFarmerId(context);
    if (!farmerId) {
      return [];
    }
    const counts = countByStatus(await listFarmerBookings(context, farmerId));
    const farm = href("/dashboard/my-farm");
    return [
      {
        label: s.open,
        value: OPEN_BOOKING_STATUSES.reduce((sum, status) => sum + counts[status], 0),
        href: farm,
      },
      { label: s.sprayed, value: counts.completed + counts.verified, href: farm },
    ];
  }
  return [];
}

// The farmer's fields with their crop health, beside booking as the main
// farmer feature (ADR 0025). Fields without a boundary invite the farmer to
// draw one.
async function CropHealthSection({
  context,
  locale,
  t,
}: {
  context: ActiveMembershipContext;
  locale: Locale;
  t: Dictionary;
}) {
  const farmerId = await getOwnFarmerId(context);
  if (!farmerId) {
    return null;
  }
  const fields = (await listFarmerFields(context, farmerId, locale)).filter(
    (field) => field.isActive
  );
  const health = await listFieldHealth(
    context,
    fields.filter((field) => field.boundary).map((field) => field.id)
  );
  // Each card's thumbnail is the latest clear pass's real pixels.
  const pixels = new Map(
    await Promise.all(
      [...health].map(
        async ([fieldId, entry]) =>
          [
            fieldId,
            entry.latestClear ? await loadPixelCells(context, entry.latestClear) : null,
          ] as const
      )
    )
  );
  const now = new Date();
  const c = t.cropHealth;

  return (
    <section aria-labelledby="crop-health-heading" className="space-y-3">
      <div>
        <h2 id="crop-health-heading" className="flex items-center gap-2 text-lg font-bold text-ink">
          <PlantIcon weight="duotone" className="size-5 text-brand" aria-hidden />
          {c.heading}
        </h2>
        <p className="text-sm text-ink-muted">{c.intro}</p>
      </div>
      {fields.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-leaf/60 p-4">
          <p className="text-ink-muted">{c.noFields}</p>
          <Link
            href={withLocale(locale, "/dashboard/my-farm#my-fields")}
            className={buttonClass({ variant: "secondary", size: "sm" })}
          >
            {c.addField}
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((field) => (
            <li key={field.id}>
              <CropHealthCard
                field={field}
                health={health.get(field.id)}
                pixels={pixels.get(field.id) ?? null}
                viewHref={withLocale(locale, `/dashboard/fields/${field.id}`)}
                drawHref={withLocale(locale, `/dashboard/fields/${field.id}/boundary`)}
                now={now}
                locale={locale}
                t={c}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Hero({
  name,
  subtitle,
  date,
  stats,
  summaryLabel,
  action,
}: {
  name: string;
  subtitle: string;
  date: string;
  stats: Stat[];
  summaryLabel: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-linear-135 from-brand to-forest p-5 text-white shadow-raised sm:p-7">
      {/* Furrows: crop rows running across the corner of the card. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-[0.14] [mask-image:linear-gradient(110deg,transparent_35%,black_80%)]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-28deg, var(--leaf) 0 3px, transparent 3px 22px)",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute -top-24 -right-16 -z-10 size-72 rounded-full bg-leaf opacity-25 blur-3xl"
      />
      <p className="text-sm font-semibold text-leaf">{date}</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{name}</h1>
      <p className="mt-0.5 text-white/75">{subtitle}</p>

      {stats.length > 0 ? (
        <>
          <h2 className="sr-only">{summaryLabel}</h2>
          <ul className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            {stats.map((stat) => (
              <li key={stat.label}>
                <Link
                  href={stat.href}
                  className="block h-full rounded-2xl bg-white/10 px-3 py-3 transition hover:bg-white/15 sm:px-4"
                >
                  <span className="block text-3xl leading-none font-bold tabular-nums sm:text-4xl">
                    {stat.value}
                  </span>
                  <span className="mt-1.5 block text-sm leading-tight text-white/80">
                    {stat.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}

async function DashboardContent() {
  await connection();
  const { locale, t } = await getDictionary();
  const context = await resolveActiveOrganization();
  if (!context) {
    redirect(withLocale(locale, "/login"));
  }

  const { data: profile } = await context.supabase
    .from("profiles")
    .select("full_name")
    .eq("id", context.user.id)
    .maybeSingle();
  const name = profile?.full_name || context.user.email || "";
  const active = context.membership;

  if (!active) {
    // Not in an organization yet: join this site's organization as a farmer,
    // or see that an administrator must add them (ADR 0018).
    redirect(withLocale(locale, "/register/join"));
  }

  const membershipContext: ActiveMembershipContext = {
    supabase: context.supabase,
    organizationId: active.organization_id,
    userId: context.user.id,
    role: active.role,
  };
  const stats = await loadStats(membershipContext, locale, t);
  const shortcuts = navItemsForRole(active.role).filter(
    (item): item is typeof item & { label: ShortcutLabel } => item.label !== "home"
  );
  const date = new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  return (
    <>
      <Hero
        name={format(t.dashboard.greeting, { name })}
        subtitle={format(t.dashboard.roleIn, {
          role: t.shell.roles[active.role],
          organization: active.organization.name,
        })}
        date={date}
        stats={stats}
        summaryLabel={t.dashboard.summary}
        action={
          active.role === "farmer" ? (
            <Link
              href={withLocale(locale, "/dashboard/my-farm#book")}
              className={buttonClass({ variant: "accent" })}
            >
              <PlusIcon weight="bold" className="size-5" aria-hidden />
              {t.dashboard.bookSpray}
            </Link>
          ) : null
        }
      />

      {active.role === "farmer" ? (
        <CropHealthSection context={membershipContext} locale={locale} t={t} />
      ) : null}

      <section aria-labelledby="shortcuts-heading" className="space-y-3">
        <h2 id="shortcuts-heading" className="text-lg font-bold text-ink">
          {t.dashboard.shortcuts}
        </h2>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {shortcuts.map((item) => {
            const { icon: Icon, tone } = SHORTCUTS[item.label];
            return (
              <li key={item.path}>
                <Link
                  href={withLocale(locale, item.path)}
                  className="flex h-full flex-col gap-3 rounded-2xl bg-surface p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-raised"
                >
                  <span className={`flex size-12 items-center justify-center rounded-2xl ${tone}`}>
                    <Icon weight="duotone" className="size-7" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-lg leading-tight font-bold text-ink">
                      {shortcutLabel(item.label, t)}
                    </span>
                    <span className="mt-1 block text-sm leading-snug text-ink-muted">
                      {t.dashboard.hints[item.label]}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {context.memberships.length > 1 ? (
        <Panel title={t.dashboard.switchOrganization}>
          <form
            action="/api/organization/select"
            method="post"
            className="flex flex-wrap items-end gap-3"
          >
            <Field label={t.dashboard.switchOrganization} className="min-w-0 flex-1">
              <select
                className={controlClass}
                name="organizationId"
                defaultValue={active.organization_id}
              >
                {context.memberships.map((membership) => (
                  <option key={membership.organization_id} value={membership.organization_id}>
                    {membership.organization.name} ({t.shell.roles[membership.role]})
                  </option>
                ))}
              </select>
            </Field>
            <Button variant="secondary">{t.dashboard.switch}</Button>
          </form>
        </Panel>
      ) : null}
    </>
  );
}

export default function DashboardPage() {
  return (
    <Page>
      <Suspense fallback={<PageSkeleton />}>
        <DashboardContent />
      </Suspense>
    </Page>
  );
}
