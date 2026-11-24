import { NextResponse } from "next/server";

import { localizedPath } from "@/lib/i18n/request-locale";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const redirectUrl = new URL(await localizedPath("/login"), request.url);
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.delete("agri_active_organization");
  return response;
}
