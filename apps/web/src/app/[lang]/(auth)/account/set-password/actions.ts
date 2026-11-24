"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { localizedPath } from "@/lib/i18n/request-locale";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const setPasswordSchema = z
  .object({
    password: z.string().min(8).max(72),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, { path: ["confirmPassword"] });

export async function setPasswordAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(await localizedPath("/login?error=link_invalid"));
  }

  const parsed = setPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const mismatch = parsed.error.issues.some((issue) => issue.path[0] === "confirmPassword");
    redirect(
      await localizedPath(`/account/set-password?error=${mismatch ? "mismatch" : "too_short"}`)
    );
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    redirect(await localizedPath("/account/set-password?error=failed"));
  }

  redirect(await localizedPath("/dashboard"));
}
