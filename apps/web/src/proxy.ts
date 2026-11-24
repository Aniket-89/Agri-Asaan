import { NextResponse, type NextRequest } from "next/server";

import { LOCALE_COOKIE, preferredLocale, stripLocale, withLocale } from "@/lib/i18n/config";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    return updateSupabaseSession(request, { locale: null, path: pathname });
  }

  const { locale, path } = stripLocale(pathname);

  if (!locale) {
    const target = request.nextUrl.clone();
    target.pathname = withLocale(
      preferredLocale(
        request.cookies.get(LOCALE_COOKIE)?.value,
        request.headers.get("accept-language")
      ),
      pathname
    );
    target.search = search;
    return NextResponse.redirect(target);
  }

  const response = await updateSupabaseSession(request, { locale, path });

  // Remember the language so Server Actions, Route Handlers, and unprefixed
  // links resolve to it. It holds no secret.
  if (request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      sameSite: "lax",
      maxAge: ONE_YEAR_SECONDS,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
