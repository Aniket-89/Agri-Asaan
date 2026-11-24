import type { SupabaseClient } from "@supabase/supabase-js";

import { env, isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import {
  applyTenantBranding,
  normalizeHostname,
  PLATFORM_DEFAULT_BRANDING,
  type Branding,
} from "./branding";

// Branding for unauthenticated pages, resolved from a verified hostname.
export async function getPublicBranding(hostHeader: string | null): Promise<Branding> {
  const hostname = normalizeHostname(hostHeader);
  if (!hostname || !isSupabaseConfigured) {
    return PLATFORM_DEFAULT_BRANDING;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_public_branding", {
    p_hostname: hostname,
  });

  if (error) {
    throw new Error("Unable to resolve public branding.");
  }

  return applyTenantBranding(
    PLATFORM_DEFAULT_BRANDING,
    data[0] ?? null,
    env.NEXT_PUBLIC_SUPABASE_URL
  );
}

// Branding for an organization the caller is already verified to belong to.
// RLS limits organization_settings to members of that tenant.
export async function getOrganizationBranding(
  supabase: SupabaseClient<Database>,
  organizationId: string
): Promise<Branding> {
  const { data, error } = await supabase
    .from("organization_settings")
    .select("brand_name, brand_primary_color, brand_accent_color, brand_tagline, brand_logo_path")
    .eq("tenant_id", organizationId)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load organization branding.");
  }

  return applyTenantBranding(PLATFORM_DEFAULT_BRANDING, data, env.NEXT_PUBLIC_SUPABASE_URL);
}
