import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PlatformRole = "platform_owner" | "system_admin" | "developer" | "support";

export type PlatformStaffContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  user: { id: string; email?: string };
  role: PlatformRole;
  status: "active" | "suspended";
};

export async function getPlatformContext(): Promise<PlatformStaffContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const { data, error: staffError } = await supabase
    .from("platform_staff")
    .select("role, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (staffError || !data || data.status !== "active") {
    return null;
  }

  return {
    supabase,
    user: { id: user.id, email: user.email },
    role: data.role as PlatformRole,
    status: data.status,
  };
}

export async function requirePlatformRole(
  allowedRoles: PlatformRole[]
): Promise<PlatformStaffContext> {
  const context = await getPlatformContext();
  if (!context || !allowedRoles.includes(context.role)) {
    throw new Error("Forbidden: insufficient platform privileges");
  }
  return context;
}

export async function isPlatformOwner() {
  const context = await getPlatformContext();
  return context?.role === "platform_owner";
}

export async function isSystemAdmin() {
  const context = await getPlatformContext();
  return context?.role === "system_admin";
}

export async function isPlatformStaff() {
  return Boolean(await getPlatformContext());
}
