import { connection } from "next/server";

import { getPlatformContext } from "@/modules/platform";
import { provisionOrganizationAction } from "./actions";

export const instant = false;

export default async function NewOrganizationPage() {
  await connection();
  const context = await getPlatformContext();

  if (!context || !["platform_owner", "system_admin"].includes(context.role)) {
    return <p>Forbidden</p>;
  }

  return (
    <main className="max-w-xl space-y-6">
      <h1 className="text-3xl font-semibold">Create organization</h1>
      <form action={provisionOrganizationAction} className="space-y-4 rounded-xl border bg-white p-6">
        <label className="block">
          <span className="mb-1 block text-sm">Organization name</span>
          <input className="w-full rounded border px-3 py-2" name="name" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Slug</span>
          <input className="w-full rounded border px-3 py-2" name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Organization type</span>
          <select className="w-full rounded border px-3 py-2" name="organizationType" defaultValue="customer">
            <option value="customer">Customer</option>
            <option value="agriasaan">AgriAsaan</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Initial organization admin profile UUID</span>
          <input className="w-full rounded border px-3 py-2" name="initialAdminId" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Brand name</span>
          <input className="w-full rounded border px-3 py-2" name="brandName" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Brand primary color</span>
          <input className="w-full rounded border px-3 py-2" name="brandPrimaryColor" placeholder="#2563EB" />
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm">Enabled modules</legend>
          <label className="block"><input type="checkbox" name="enabledFeatures" value="crop_monitoring" /> Crop monitoring</label>
        </fieldset>
        <button className="w-full rounded bg-black px-4 py-3 text-white" type="submit">Provision organization</button>
      </form>
    </main>
  );
}
