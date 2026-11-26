import { Suspense } from "react";

import { ComingSoonPage } from "@/components/coming-soon/coming-soon-page";
import { getRequestBranding } from "@/lib/branding/request-branding";
import { withLocale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";

async function BrandedComingSoon() {
  const [branding, { locale, t }] = await Promise.all([getRequestBranding(), getDictionary()]);
  return (
    <ComingSoonPage
      branding={branding}
      signIn={{ href: withLocale(locale, "/login"), label: t.login.submit }}
    />
  );
}

export default function HomePage() {
  return (
    // The fallback must stay brand-neutral: on a white-label domain the
    // platform brand must never flash before the tenant brand resolves.
    <Suspense fallback={<main className="min-h-screen bg-[#f8eddb]" aria-busy="true" />}>
      <BrandedComingSoon />
    </Suspense>
  );
}
