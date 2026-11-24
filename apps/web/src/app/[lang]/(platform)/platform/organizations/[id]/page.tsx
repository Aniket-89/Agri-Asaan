import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { getPlatformContext } from "@/modules/platform";

export const instant = false;

export default async function OrganizationDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const context = await getPlatformContext();
  const parsedId = z.uuid().safeParse((await params).id);

  if (!context) {
    return null;
  }
  if (!parsedId.success) {
    notFound();
  }
  const id = parsedId.data;

  // Cross-tenant reads by platform staff must be audited (ADR 0005). Fail
  // closed: tenant data is not shown if the access cannot be recorded.
  const { error: auditError } = await context.supabase.rpc("log_platform_tenant_access", {
    p_tenant_id: id,
    p_context: "organization_details",
  });
  if (auditError) {
    throw new Error("Unable to record platform access.");
  }

  const { data: organization } = await context.supabase
    .from("organizations")
    .select("id, name, slug, organization_type, is_active, created_at")
    .eq("id", id)
    .maybeSingle();

  const { data: settings } = await context.supabase
    .from("organization_settings")
    .select("brand_name, brand_primary_color, default_locale, timezone")
    .eq("tenant_id", id)
    .maybeSingle();

  const { data: features } = await context.supabase
    .from("organization_features")
    .select("feature_key, enabled")
    .eq("tenant_id", id);

  if (!organization) {
    return <p className="text-neutral-400">Organization not found or not accessible.</p>;
  }

  return (
    <main className="space-y-6">
      <h1 className="text-3xl font-semibold">{organization.name}</h1>
      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <p>
          <strong>Slug:</strong> {organization.slug}
        </p>
        <p>
          <strong>Type:</strong> {organization.organization_type}
        </p>
        <p>
          <strong>Status:</strong> {organization.is_active ? "Active" : "Inactive"}
        </p>
      </section>
      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-xl font-semibold">Branding</h2>
        <p>
          <strong>Brand:</strong> {settings?.brand_name ?? "Not set"}
        </p>
        <p>
          <strong>Primary color:</strong> {settings?.brand_primary_color ?? "Not set"}
        </p>
        <p>
          <strong>Locale:</strong> {settings?.default_locale}
        </p>
        <p>
          <strong>Timezone:</strong> {settings?.timezone}
        </p>
      </section>
      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-xl font-semibold">Enabled modules</h2>
        {(features ?? [])
          .filter((feature) => feature.enabled)
          .map((feature) => (
            <p key={feature.feature_key}>{feature.feature_key}</p>
          ))}
        {(features ?? []).filter((feature) => feature.enabled).length === 0 ? <p>None</p> : null}
      </section>
    </main>
  );
}
