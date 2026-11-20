import type { ReactNode } from "react";
import Link from "next/link";

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 [color-scheme:dark]">
      <nav className="flex gap-4 border-b border-neutral-800 bg-neutral-900 px-6 py-4">
        <Link className="font-semibold hover:text-emerald-300" href="/platform">Overview</Link>
        <Link className="hover:text-emerald-300" href="/platform/organizations">Organizations</Link>
        <Link className="hover:text-emerald-300" href="/platform/staff">Platform staff</Link>
      </nav>
      <div className="mx-auto max-w-5xl p-6">{children}</div>
    </main>
  );
}
