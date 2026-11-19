import Link from "next/link";
import { connection } from "next/server";

import { getPlatformContext } from "@/modules/platform";

export const instant = false;

export default async function OrganizationsPage() {
  await connection();
  const context = await getPlatformContext();

  if (!context) {
    return null;
  }

  const { data: organizations, error } = await context.supabase
    .from("organizations")
    .select("id, name, slug, organization_type, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Unable to load organizations.");
  }

  const canProvision = context.role === "platform_owner" || context.role === "system_admin";

  return (
    <main className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Organizations</h1>
        {canProvision ? (
          <Link className="rounded bg-black px-4 py-2 text-white" href="/platform/organizations/new">
            Create organization
          </Link>
        ) : null}
      </header>

      <div className="space-y-3">
        {(organizations ?? []).map((organization) => (
          <Link
            key={organization.id}
            className="block rounded-xl border bg-white p-4"
            href={`/platform/organizations/${organization.id}`}
          >
            <p className="font-semibold">{organization.name}</p>
            <p className="text-sm text-gray-600">/{organization.slug} · {organization.organization_type}</p>
          </Link>
        ))}
        {organizations?.length === 0 ? <p>No organizations provisioned yet.</p> : null}
      </div>
    </main>
  );
}
