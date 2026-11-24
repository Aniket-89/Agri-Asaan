import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { withLocale, type Locale } from "@/lib/i18n/config";
import type { Database } from "@/types/database.types";

export type LocalizedRoute = {
  // null for non-page requests such as /api/*, which get no auth redirects.
  locale: Locale | null;
  // Path without the locale prefix, e.g. "/dashboard".
  path: string;
};

export async function updateSupabaseSession(request: NextRequest, route: LocalizedRoute) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { locale } = route;
  if (!locale) {
    return response;
  }

  const redirectTo = (path: string) => {
    const target = request.nextUrl.clone();
    target.pathname = withLocale(locale, path);
    target.search = "";
    return NextResponse.redirect(target);
  };

  if (route.path.startsWith("/dashboard") && !user) {
    return redirectTo("/login");
  }

  if (route.path.startsWith("/platform")) {
    if (!user) {
      return redirectTo("/login");
    }

    const { data: staff } = await supabase
      .from("platform_staff")
      .select("role, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!staff) {
      return redirectTo("/dashboard");
    }
  }

  if ((route.path === "/login" || route.path === "/register") && user) {
    return redirectTo("/dashboard");
  }

  return response;
}
