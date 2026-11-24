import type { ReactNode } from "react";
import Link from "next/link";

import { withLocale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/dictionary";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 [color-scheme:dark]">
      <nav className="flex gap-4 border-b border-neutral-800 bg-neutral-900 px-6 py-4">
        <Link
          className="font-semibold hover:text-emerald-300"
          href={withLocale(locale, "/platform")}
        >
          Overview
        </Link>
        <Link
          className="hover:text-emerald-300"
          href={withLocale(locale, "/platform/organizations")}
        >
          Organizations
        </Link>
        <Link className="hover:text-emerald-300" href={withLocale(locale, "/platform/staff")}>
          Platform staff
        </Link>
      </nav>
      <div className="mx-auto max-w-5xl p-6">{children}</div>
    </main>
  );
}
