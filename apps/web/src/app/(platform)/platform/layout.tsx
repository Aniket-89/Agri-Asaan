import type { ReactNode } from "react";
import Link from "next/link";

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50">
      <nav className="flex gap-4 border-b bg-white px-6 py-4">
        <Link className="font-semibold" href="/platform">Overview</Link>
        <Link href="/platform/organizations">Organizations</Link>
        <Link href="/platform/staff">Platform staff</Link>
      </nav>
      <div className="mx-auto max-w-5xl p-6">{children}</div>
    </main>
  );
}
