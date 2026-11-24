import { cache } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";

import { getPublicBranding } from "@/modules/branding";

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
