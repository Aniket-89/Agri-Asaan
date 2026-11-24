import { Suspense } from "react";

import { ComingSoonPage } from "@/components/coming-soon/coming-soon-page";
import { getRequestBranding } from "@/lib/branding/request-branding";

async function BrandedComingSoon() {
  const branding = await getRequestBranding();
  return <ComingSoonPage branding={branding} />;
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
