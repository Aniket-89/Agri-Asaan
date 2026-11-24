import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { localizedPath } from "@/lib/i18n/request-locale";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Email links (pilot invites) land here. The one-time token is verified
// server-side, which signs the person in, and they are sent to set a password.
// Only the "invite" type is accepted; the destination is fixed, never taken
// from the URL, so this cannot be used as an open redirect.
const confirmSchema = z.object({
  token_hash: z.string().min(10).max(512),
  type: z.literal("invite"),
});

// Relative Location header: the browser stays on the host it used for the
// link. Building an absolute URL from request.url can switch hosts (e.g.
// 127.0.0.1 vs localhost), and the session cookie just set would be lost.
async function redirectTo(path: string) {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: await localizedPath(path), "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  const parsed = confirmSchema.safeParse({
    token_hash: request.nextUrl.searchParams.get("token_hash"),
    type: request.nextUrl.searchParams.get("type"),
  });
  if (!parsed.success) {
    return redirectTo("/login?error=link_invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    type: parsed.data.type,
    token_hash: parsed.data.token_hash,
  });
  if (error) {
    return redirectTo("/login?error=link_invalid");
  }

  return redirectTo("/account/set-password");
}
