import "server-only";

import { z } from "zod";

// Server-only secrets. Importing this module from browser code fails the build.
// Parsed lazily so builds and pages that never need the secret do not
// require it to be configured.
const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

export function getServerEnv() {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      "Server environment is incomplete: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for this operation."
    );
  }
  return parsed.data;
}
