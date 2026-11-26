import { cache } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";

import { getPublicBranding, normalizeHostname } from "@/modules/branding";

// Public branding for the current request's hostname, deduplicated so the
// metadata and the page body share one database lookup per request.
//
// connection() keeps this out of runtime prefetch prerenders: creating a
// Supabase server client starts an auth session load that reads the current
// time, which Next.js rejects while prerendering.
export const getRequestBranding = cache(async () => {
  await connection();
  const requestHeaders = await headers();
  return getPublicBranding(requestHeaders.get("host"));
});

// The current request's normalized hostname, for hostname-scoped lookups
// such as farmer sign-up. A hostname is never authorization by itself.
export async function getRequestHostname(): Promise<string | null> {
  await connection();
  return normalizeHostname((await headers()).get("host"));
}
