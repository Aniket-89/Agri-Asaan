import { NextResponse } from "next/server";

import { localizedPath } from "@/lib/i18n/request-locale";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// 303 (not the default 307) so the browser follows the redirect with GET;
// a 307 would re-send the POST to a page and fail with 405.
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const redirectUrl = new URL(await localizedPath("/login"), request.url);
  const response = NextResponse.redirect(redirectUrl, 303);
  response.cookies.delete("agri_active_organization");
  return response;
}
