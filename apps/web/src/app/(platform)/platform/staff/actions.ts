"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePlatformRole } from "@/modules/platform";

const staffSchema = z.object({
  userId: z.uuid(),
  role: z.enum(["platform_owner", "system_admin", "developer", "support"]),
  status: z.enum(["active", "suspended"]),
});

export async function managePlatformStaffAction(formData: FormData) {
  const context = await requirePlatformRole(["platform_owner", "system_admin"]);

  const parsed = staffSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    redirect("/platform/staff?error=invalid_input");
  }

  if (context.role === "system_admin" && parsed.data.role === "platform_owner") {
    redirect("/platform/staff?error=owner_assignment_denied");
  }

  const { error } = await context.supabase.rpc("manage_platform_staff", {
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
    p_status: parsed.data.status,
  });

  if (error) {
    redirect("/platform/staff?error=staff_update_failed");
  }

  redirect("/platform/staff");
}
