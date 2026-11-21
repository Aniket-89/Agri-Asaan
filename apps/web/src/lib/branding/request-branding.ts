import { cache } from "react";
import { headers } from "next/headers";

import { getPublicBranding } from "@/modules/branding";

// Public branding for the current request's hostname, deduplicated so the
// metadata and the page body share one database lookup per request.
export const getRequestBranding = cache(async () => {
  const requestHeaders = await headers();
  return getPublicBranding(requestHeaders.get("host"));
});
