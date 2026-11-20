"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePlatformRole } from "@/modules/platform";

const provisionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  organizationType: z.enum(["customer", "agriasaan"]),
  initialAdminEmail: z.string().trim().email().max(320),
  brandName: z.string().trim().max(120).optional(),
  brandPrimaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .or(z.literal("")),
  enabledFeatures: z.array(z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/)).default([]),
});

export async function provisionOrganizationAction(formData: FormData) {
  const context = await requirePlatformRole(["platform_owner", "system_admin"]);

  const parsed = provisionSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    organizationType: formData.get("organizationType"),
    initialAdminEmail: formData.get("initialAdminEmail"),
    brandName: formData.get("brandName") || undefined,
    brandPrimaryColor: formData.get("brandPrimaryColor") || "",
    enabledFeatures: formData.getAll("enabledFeatures"),
  });

  if (!parsed.success) {
    redirect("/platform/organizations/new?error=invalid_input");
  }

  const { data: organizationId, error } = await context.supabase.rpc(
    "provision_customer_organization",
    {
      p_name: parsed.data.name,
      p_slug: parsed.data.slug,
      p_organization_type: parsed.data.organizationType,
      p_initial_admin_email: parsed.data.initialAdminEmail,
      p_brand_name: parsed.data.brandName ?? null,
      p_brand_primary_color:
        parsed.data.brandPrimaryColor || null,
      p_enabled_features: parsed.data.enabledFeatures,
    }
  );

  if (error || !organizationId) {
    redirect("/platform/organizations/new?error=provision_failed");
  }

  redirect(`/platform/organizations/${organizationId}`);
}
