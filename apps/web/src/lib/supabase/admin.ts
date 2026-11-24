import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env/server";
import type { Database } from "@/types/database.types";

// Service-role client: bypasses RLS. Use ONLY for privileged operations that
// have already been authorized with the caller's own session (AGENTS.md 6.6),
// and keep each use narrow. Never import this into client code; the
// `server-only` import above makes that a build error.
export function createSupabaseAdminClient() {
  const env = getServerEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
