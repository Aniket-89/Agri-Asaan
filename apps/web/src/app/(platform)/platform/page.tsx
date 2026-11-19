import { connection } from "next/server";

import { getPlatformContext } from "@/modules/platform";

export const instant = false;

export default async function PlatformOverviewPage() {
  await connection();
  const context = await getPlatformContext();

  if (!context) {
    return null;
  }

  const { data: organizations } = await context.supabase
    .from("organizations")
    .select("id");

  return (
    <main className="space-y-6">
      <h1 className="text-3xl font-semibold">Platform overview</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
          <p className="text-sm text-neutral-400">Your platform role</p>
          <p className="mt-1 font-semibold">{context.role}</p>
        </section>
        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
          <p className="text-sm text-neutral-400">Organizations</p>
          <p className="mt-1 text-2xl font-semibold">{organizations?.length ?? 0}</p>
        </section>
      </div>
    </main>
  );
}
