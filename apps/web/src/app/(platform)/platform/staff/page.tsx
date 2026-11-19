import { connection } from "next/server";

import { getPlatformContext } from "@/modules/platform";
import { managePlatformStaffAction } from "./actions";

export const instant = false;

export default async function PlatformStaffPage() {
  await connection();
  const context = await getPlatformContext();

  if (!context) {
    return null;
  }

  const { data: staff } = await context.supabase
    .from("platform_staff")
    .select("id, user_id, role, status, created_at")
    .order("created_at", { ascending: false });

  const canManage = context.role === "platform_owner" || context.role === "system_admin";

  return (
    <main className="space-y-6">
      <h1 className="text-3xl font-semibold">Platform staff</h1>

      {canManage ? (
        <form action={managePlatformStaffAction} className="grid gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-5 sm:grid-cols-4">
          <label>
            <span className="mb-1 block text-sm">Profile UUID</span>
            <input className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 focus:border-emerald-400 focus:outline-none" name="userId" required />
          </label>
          <label>
            <span className="mb-1 block text-sm">Role</span>
            <select className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 focus:border-emerald-400 focus:outline-none" name="role" defaultValue="developer">
              {context.role === "platform_owner" ? <option value="platform_owner">Platform owner</option> : null}
              <option value="system_admin">System admin</option>
              <option value="developer">Developer</option>
              <option value="support">Support</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm">Status</span>
            <select className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 focus:border-emerald-400 focus:outline-none" name="status" defaultValue="active">
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
          <button className="self-end rounded bg-emerald-400 px-4 py-2 font-semibold text-neutral-950 hover:bg-emerald-300" type="submit">Save</button>
        </form>
      ) : null}

      <div className="space-y-3">
        {(staff ?? []).map((member) => (
          <section key={member.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <p className="font-semibold">{member.role}</p>
            <p className="text-sm text-neutral-400">Status: {member.status}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
