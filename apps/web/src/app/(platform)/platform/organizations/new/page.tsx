import { connection } from "next/server";

import { getPlatformContext } from "@/modules/platform";
import { provisionOrganizationAction } from "./actions";

export const instant = false;

export default async function NewOrganizationPage() {
  await connection();
  const context = await getPlatformContext();

  if (!context || !["platform_owner", "system_admin"].includes(context.role)) {
    return <p className="text-rose-300">Forbidden</p>;
  }

  return (
    <main className="max-w-xl space-y-6">
      <h1 className="text-3xl font-semibold">Create organization</h1>
      <form action={provisionOrganizationAction} className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <label className="block">
          <span className="mb-1 block text-sm">Organization name</span>
          <input className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 focus:border-emerald-400 focus:outline-none" name="name" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Slug</span>
          <input className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 focus:border-emerald-400 focus:outline-none" name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Organization type</span>
          <select className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 focus:border-emerald-400 focus:outline-none" name="organizationType" defaultValue="customer">
            <option value="customer">Customer</option>
            <option value="agriasaan">AgriAsaan</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Organization admin email</span>
          <input className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 focus:border-emerald-400 focus:outline-none" name="initialAdminEmail" type="email" autoComplete="email" required />
          <span className="mt-1 block text-sm text-neutral-400">Use the email for an existing AgriAsaan account. They will be added as an organization admin.</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Brand name</span>
          <input className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 focus:border-emerald-400 focus:outline-none" name="brandName" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Brand primary color</span>
          <input className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-400 focus:outline-none" name="brandPrimaryColor" placeholder="#2563EB" />
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm">Enabled modules</legend>
          <label className="block"><input type="checkbox" name="enabledFeatures" value="crop_monitoring" /> Crop monitoring</label>
        </fieldset>
        <button className="w-full rounded bg-emerald-400 px-4 py-3 font-semibold text-neutral-950 hover:bg-emerald-300" type="submit">Provision organization</button>
      </form>
    </main>
  );
}
