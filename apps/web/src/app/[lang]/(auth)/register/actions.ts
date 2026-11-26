"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getRequestHostname } from "@/lib/branding/request-branding";
import { localizedPath } from "@/lib/i18n/request-locale";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { farmerSignupSchema, getSignupOptions, registerSelfAsFarmer } from "@/modules/farmers";

// The public sign-up is for farmers only (ADR 0018). Staff accounts (mitras,
// pilots, admins) are created by administrators.
const registrationSchema = farmerSignupSchema.extend({
  email: z.email(),
  password: z.string().min(6).max(72),
});

function formValues(formData: FormData) {
  return {
    villageId: formData.get("villageId"),
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    subdistrictCode: formData.get("subdistrictCode"),
    pincode: formData.get("pincode"),
    locality: formData.get("locality"),
    addressLine: formData.get("addressLine"),
    consent: formData.get("consent"),
  };
}

export async function registerAction(formData: FormData) {
  const parsed = registrationSchema.safeParse({
    ...formValues(formData),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    redirect(await localizedPath("/register?error=invalid_registration"));
  }

  const supabase = await createSupabaseServerClient();
  const hostname = await getRequestHostname();

  // Check the site and village before creating an account, so a closed site
  // never leaves accounts without an organization.
  const options = await getSignupOptions(supabase, hostname);
  if (!options.open) {
    redirect(await localizedPath("/register?error=closed"));
  }
  const { villageId } = parsed.data;
  if (villageId && !options.villages.some((village) => village.id === villageId)) {
    redirect(await localizedPath("/register?error=invalid_registration"));
  }

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });

  if (error?.code === "user_already_exists") {
    redirect(await localizedPath("/register?error=email_in_use"));
  }
  if (error || !data.user) {
    redirect(await localizedPath("/register?error=registration_failed"));
  }

  // With email verification on there is no session yet: the person verifies,
  // signs in, and finishes on the join page.
  if (!data.session) {
    redirect(await localizedPath("/register/check-email"));
  }

  const result = await registerSelfAsFarmer(supabase, hostname, parsed.data);
  redirect(await localizedPath(result.ok ? "/dashboard" : `/register/join?error=${result.error}`));
}

// A signed-in account without an organization joins this site's organization
// as a farmer (accounts created before ADR 0018, or after email verification).
export async function joinAsFarmerAction(formData: FormData) {
  const parsed = farmerSignupSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    redirect(await localizedPath("/register/join?error=invalid"));
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(await localizedPath("/login"));
  }

  const result = await registerSelfAsFarmer(supabase, await getRequestHostname(), parsed.data);
  if (result.ok || result.error === "already_member") {
    redirect(await localizedPath("/dashboard"));
  }
  redirect(await localizedPath(`/register/join?error=${result.error}`));
}
