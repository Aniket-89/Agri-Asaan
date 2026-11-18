import { connection } from "next/server";

import { getPlatformContext } from "@/modules/platform";

export const instant = false;

export default async function OrganizationDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const context = await getPlatformContext();
  const { id } = await params;

  if (!context) {
    return null;
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
    return <p>Organization not found or not accessible.</p>;
  }

  return (
    <main className="space-y-6">
      <h1 className="text-3xl font-semibold">{organization.name}</h1>
      <section className="rounded-xl border bg-white p-5">
        <p><strong>Slug:</strong> {organization.slug}</p>
        <p><strong>Type:</strong> {organization.organization_type}</p>
        <p><strong>Status:</strong> {organization.is_active ? "Active" : "Inactive"}</p>
      </section>
      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-xl font-semibold">Branding</h2>
        <p><strong>Brand:</strong> {settings?.brand_name ?? "Not set"}</p>
        <p><strong>Primary color:</strong> {settings?.brand_primary_color ?? "Not set"}</p>
        <p><strong>Locale:</strong> {settings?.default_locale}</p>
        <p><strong>Timezone:</strong> {settings?.timezone}</p>
      </section>
      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-xl font-semibold">Enabled modules</h2>
        {(features ?? []).filter((feature) => feature.enabled).map((feature) => (
          <p key={feature.feature_key}>{feature.feature_key}</p>
        ))}
        {(features ?? []).filter((feature) => feature.enabled).length === 0 ? <p>None</p> : null}
      </section>
    </main>
  );
}
