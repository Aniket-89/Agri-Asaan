import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { HourglassMediumIcon, PlantIcon } from "@phosphor-icons/react/dist/ssr";
import { z } from "zod";

import { AuthScreen } from "@/components/layout/auth-screen";
import { BrandTokens } from "@/components/layout/brand-tokens";
import { StatusBanner } from "@/components/shared/status-banner";
import { Button, buttonClass } from "@/components/ui";
import { getRequestBranding, getRequestHostname } from "@/lib/branding/request-branding";
import { format, withLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getSignupOptions } from "@/modules/farmers";
import { FarmerSignupFields } from "@/modules/farmers/components/farmer-signup-fields";
import { resolveActiveOrganization } from "@/modules/organizations";

import { joinAsFarmerAction } from "../actions";

const searchSchema = z.object({
  error: z.enum(["invalid", "closed", "already_member"]).optional().catch(undefined),
});

// Reads the session, so it renders per request (no instant navigation shell).
export const instant = false;

const headingClass = "text-2xl font-bold tracking-tight text-ink";

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-14 items-center justify-center rounded-2xl bg-leaf-soft text-leaf-ink"
    >
      {children}
    </span>
  );
}

// For a signed-in account with no organization: join this site's organization
// as a farmer, or learn that an administrator must add them.
async function JoinForm({
  searchParams,
  locale,
  t,
}: {
  searchParams: PageProps<"/[lang]/register/join">["searchParams"];
  locale: Locale;
  t: Dictionary["register"];
}) {
  await connection();
  const context = await resolveActiveOrganization();
  if (!context) {
    redirect(withLocale(locale, "/login"));
  }
  if (context.membership) {
    redirect(withLocale(locale, "/dashboard"));
  }

  const [{ error }, branding, hostname, profile] = await Promise.all([
    searchParams.then((params) => searchSchema.parse(params)),
    getRequestBranding(),
    getRequestHostname(),
    context.supabase.from("profiles").select("full_name").eq("id", context.user.id).maybeSingle(),
  ]);
  const { open, villages, places } = await getSignupOptions(context.supabase, hostname);

  if (!open) {
    return (
      <>
        <IconTile>
          <HourglassMediumIcon weight="duotone" className="size-8" />
        </IconTile>
        <h1 className={headingClass}>{t.pendingTitle}</h1>
        <p className="text-ink-muted">{t.pendingBody}</p>
      </>
    );
  }

  return (
    <>
      <BrandTokens branding={branding} />
      <IconTile>
        <PlantIcon weight="duotone" className="size-8" />
      </IconTile>
      <div className="space-y-1">
        <h1 className={headingClass}>{t.joinTitle}</h1>
        <p className="text-ink-muted">{format(t.joinIntro, { brand: branding.name })}</p>
      </div>
      {error ? <StatusBanner kind="error" text={t.errors[error]} /> : null}
      <form action={joinAsFarmerAction} className="space-y-4">
        <FarmerSignupFields
          villages={villages}
          places={places}
          brandName={branding.name}
          defaultName={profile.data?.full_name ?? ""}
          t={t}
        />
        <Button block>{t.joinSubmit}</Button>
      </form>
    </>
  );
}

export default async function JoinPage({ searchParams }: PageProps<"/[lang]/register/join">) {
  const { locale, t } = await getDictionary();
  return (
    <AuthScreen>
      <Suspense fallback={<h1 className={headingClass}>{t.register.joinTitle}</h1>}>
        <JoinForm searchParams={searchParams} locale={locale} t={t.register} />
      </Suspense>
      <form action="/api/auth/signout" method="post">
        <button type="submit" className={buttonClass({ variant: "quiet", block: true })}>
          {t.shell.signOut}
        </button>
      </form>
    </AuthScreen>
  );
}
