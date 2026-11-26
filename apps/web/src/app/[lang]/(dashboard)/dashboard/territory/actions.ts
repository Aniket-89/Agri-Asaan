"use server";

import { redirect } from "next/navigation";
import type { z } from "zod";

import { localizedPath } from "@/lib/i18n/request-locale";
import { getActiveMembershipContext, resolveActiveOrganization } from "@/modules/organizations";
import {
  assignMitra,
  assignRegionalAdmin,
  createRegion,
  createVillage,
  mitraInviteInputSchema,
  regionalAdminInviteInputSchema,
  regionAssignmentSchema,
  regionInputSchema,
  removeMitra,
  removeRegionalAdmin,
  villageAssignmentSchema,
  villageInputSchema,
  type TerritoryContext,
  type TerritoryResult,
} from "@/modules/villages";
import { inviteMitra } from "@/modules/villages/mitra-invite.service";
import { inviteRegionalAdmin } from "@/modules/villages/regional-admin-invite.service";

const TERRITORY_PATH = "/dashboard/territory";

// Runs one territory operation for the caller's verified active organization,
// then returns to the territory page with a status the page can translate.
async function runTerritoryAction<Schema extends z.ZodType>(
  formData: FormData,
  schema: Schema,
  fields: string[],
  operation: (context: TerritoryContext, input: z.infer<Schema>) => Promise<TerritoryResult>
): Promise<never> {
  const active = await resolveActiveOrganization();
  if (!active?.membership) {
    redirect(await localizedPath("/login"));
  }

  const parsed = schema.safeParse(
    Object.fromEntries(fields.map((field) => [field, formData.get(field)]))
  );
  if (!parsed.success) {
    redirect(await localizedPath(`${TERRITORY_PATH}?error=invalid`));
  }

  const result = await operation(
    {
      supabase: active.supabase,
      organizationId: active.membership.organization_id,
      userId: active.user.id,
      role: active.membership.role,
    },
    parsed.data
  );

  redirect(
    await localizedPath(
      result.ok ? `${TERRITORY_PATH}?status=saved` : `${TERRITORY_PATH}?error=${result.error}`
    )
  );
}

export async function createRegionAction(formData: FormData) {
  await runTerritoryAction(formData, regionInputSchema, ["name"], createRegion);
}

export async function createVillageAction(formData: FormData) {
  await runTerritoryAction(
    formData,
    villageInputSchema,
    ["regionId", "name", "lgdCode", "latitude", "longitude"],
    createVillage
  );
}

export async function assignRegionalAdminAction(formData: FormData) {
  await runTerritoryAction(
    formData,
    regionAssignmentSchema,
    ["regionId", "userId"],
    assignRegionalAdmin
  );
}

export async function removeRegionalAdminAction(formData: FormData) {
  await runTerritoryAction(
    formData,
    regionAssignmentSchema,
    ["regionId", "userId"],
    removeRegionalAdmin
  );
}

export async function assignMitraAction(formData: FormData) {
  await runTerritoryAction(formData, villageAssignmentSchema, ["villageId", "userId"], assignMitra);
}

export async function removeMitraAction(formData: FormData) {
  await runTerritoryAction(formData, villageAssignmentSchema, ["villageId", "userId"], removeMitra);
}

export async function inviteMitraAction(formData: FormData) {
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(await localizedPath("/login"));
  }

  const parsed = mitraInviteInputSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    villageId: formData.get("villageId"),
  });
  if (!parsed.success) {
    redirect(await localizedPath(`${TERRITORY_PATH}?inviteError=invalid`));
  }

  const result = await inviteMitra(context, parsed.data);
  redirect(
    await localizedPath(
      result.ok
        ? `${TERRITORY_PATH}?status=invited`
        : `${TERRITORY_PATH}?inviteError=${result.error}`
    )
  );
}

export async function inviteRegionalAdminAction(formData: FormData) {
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(await localizedPath("/login"));
  }

  const parsed = regionalAdminInviteInputSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    regionId: formData.get("regionId"),
  });
  if (!parsed.success) {
    redirect(await localizedPath(`${TERRITORY_PATH}?inviteError=invalid`));
  }

  const result = await inviteRegionalAdmin(context, parsed.data);
  redirect(
    await localizedPath(
      result.ok
        ? `${TERRITORY_PATH}?status=invitedAdmin`
        : `${TERRITORY_PATH}?inviteError=${result.error}`
    )
  );
}
