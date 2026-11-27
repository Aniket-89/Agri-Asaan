import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { StatusBanner } from "@/components/shared/status-banner";
import { BackLink, Button, Page, PageHeader, Panel, PageSkeleton } from "@/components/ui";
import { format, withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { LngLat } from "@/lib/maps/boundary";
import { canDrawBoundary, getField } from "@/modules/fields";
import { BoundaryDrawer } from "@/modules/fields/components/boundary-drawer";
import { getActiveMembershipContext } from "@/modules/organizations";

import { removeBoundaryAction, saveBoundaryAction } from "../../actions";

export const instant = false;

const searchSchema = z.object({
  error: z.enum(["forbidden", "duplicate", "invalid", "not_found"]).optional().catch(undefined),
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.cropHealth.addBoundaryTitle };
}

async function BoundaryContent({
  params,
  searchParams,
  t,
  locale,
}: {
  params: PageProps<"/[lang]/dashboard/fields/[id]/boundary">["params"];
  searchParams: PageProps<"/[lang]/dashboard/fields/[id]/boundary">["searchParams"];
  t: Dictionary;
  locale: Locale;
}) {
  await connection();
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(withLocale(locale, "/login"));
  }
  if (!canDrawBoundary(context.role)) {
    notFound();
  }
  const fieldId = z.uuid().safeParse((await params).id);
  if (!fieldId.success) {
    notFound();
  }
  const [field, search] = await Promise.all([
    getField(context, fieldId.data, locale),
    searchParams.then((value) => searchSchema.parse(value)),
  ]);
  if (!field) {
    notFound();
  }

  const initial = (field.boundary?.coordinates[0].slice(0, -1) ?? []) as LngLat[];
  const acres = new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    maximumFractionDigits: 2,
  }).format(field.areaAcres);

  return (
    <>
      <BackLink href={withLocale(locale, `/dashboard/fields/${field.id}`)}>
        {t.cropHealth.back}
      </BackLink>
      <PageHeader
        title={format(t.boundary.title, { field: field.name })}
        description={`${field.cropName}, ${format(t.boundary.recordedArea, { area: acres })}`}
      />
      {search.error ? (
        <StatusBanner
          kind="error"
          text={search.error === "invalid" ? t.boundary.invalid : t.farmers.errors[search.error]}
        />
      ) : null}
      <Panel>
        <form action={saveBoundaryAction.bind(null, field.id)}>
          <BoundaryDrawer
            pin={{ latitude: field.latitude, longitude: field.longitude }}
            initial={initial}
            locale={locale}
            labels={{
              map: t.boundary.map,
              hint: t.boundary.hint,
              corners: t.boundary.corners,
              area: t.boundary.area,
              undo: t.boundary.undo,
              clear: t.boundary.clear,
              save: t.boundary.save,
              loading: t.maps.loading,
              needsMap: t.boundary.needsMap,
              problems: t.boundary.problems,
            }}
          />
        </form>
      </Panel>
      {field.boundary ? (
        <form action={removeBoundaryAction.bind(null, field.id)}>
          <Button type="submit" variant="quiet" size="sm">
            {t.boundary.remove}
          </Button>
        </form>
      ) : null}
    </>
  );
}

export default async function BoundaryPage({
  params,
  searchParams,
}: PageProps<"/[lang]/dashboard/fields/[id]/boundary">) {
  const { locale, t } = await getDictionary();
  return (
    <Page>
      <Suspense fallback={<PageSkeleton />}>
        <BoundaryContent params={params} searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
    </Page>
  );
}
