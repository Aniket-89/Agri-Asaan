import { createClient } from "@supabase/supabase-js";

import { env, isSupabaseConfigured, supabasePublishableKey } from "@/lib/env";

export const supabase = isSupabaseConfigured
  ? createClient(env.NEXT_PUBLIC_SUPABASE_URL!, supabasePublishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to your environment."
    );
  }

  return supabase;
}
