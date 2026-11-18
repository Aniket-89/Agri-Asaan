"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const registrationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  organizationName: z.string().trim().min(2).max(120),
  organizationSlug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  email: z.email(),
  password: z.string().min(6).max(72),
});

export async function registerAction(formData: FormData) {
  const parsed = registrationSchema.safeParse({
    fullName: formData.get("fullName"),
    organizationName: formData.get("organizationName"),
    organizationSlug: formData.get("organizationSlug"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect("/register?error=invalid_registration");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });

  if (error || !data.user) {
    redirect("/register?error=registration_failed");
  }

  const { data: organizationId, error: organizationError } = await supabase.rpc(
    "create_organization_for_current_user",
    {
      p_name: parsed.data.organizationName,
      p_slug: parsed.data.organizationSlug,
    }
  );

  if (organizationError || !organizationId) {
    redirect("/register?error=organization_failed");
  }

  const cookieStore = await cookies();
  cookieStore.set("agri_active_organization", organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  redirect("/dashboard");
}
