"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { localizedPath } from "@/lib/i18n/request-locale";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(await localizedPath("/login?error=invalid_credentials"));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    redirect(await localizedPath("/login?error=invalid_credentials"));
  }

  redirect(await localizedPath("/dashboard"));
}
