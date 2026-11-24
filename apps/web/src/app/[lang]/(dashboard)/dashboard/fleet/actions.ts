"use server";

import { redirect } from "next/navigation";
import type { z } from "zod";

import { localizedPath } from "@/lib/i18n/request-locale";
import {
  addDrone,
  droneInputSchema,
  droneStatusInputSchema,
  setDroneStatus,
  type FleetResult,
} from "@/modules/drones";
import { getActiveMembershipContext, type ActiveMembershipContext } from "@/modules/organizations";
import {
  createPilotProfile,
  pilotAvailabilityInputSchema,
  pilotProfileInputSchema,
  setPilotAvailability,
} from "@/modules/pilots";

const FLEET_PATH = "/dashboard/fleet";

async function runFleetAction<Schema extends z.ZodType>(
  formData: FormData,
  schema: Schema,
  fields: string[],
  operation: (context: ActiveMembershipContext, input: z.infer<Schema>) => Promise<FleetResult>
): Promise<never> {
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(await localizedPath("/login"));
  }

  const parsed = schema.safeParse(
    Object.fromEntries(fields.map((field) => [field, formData.get(field)]))
  );
  if (!parsed.success) {
    redirect(await localizedPath(`${FLEET_PATH}?error=invalid`));
  }

  const result = await operation(context, parsed.data);
  redirect(
    await localizedPath(
      result.ok ? `${FLEET_PATH}?status=saved` : `${FLEET_PATH}?error=${result.error}`
    )
  );
}

export async function addDroneAction(formData: FormData) {
  await runFleetAction(formData, droneInputSchema, ["uid", "model", "homeRegionId"], addDrone);
}

export async function setDroneStatusAction(formData: FormData) {
  await runFleetAction(formData, droneStatusInputSchema, ["droneId", "status"], setDroneStatus);
}

export async function createPilotProfileAction(formData: FormData) {
  await runFleetAction(
    formData,
    pilotProfileInputSchema,
    ["userId", "homeRegionId", "licenseNumber"],
    createPilotProfile
  );
}

export async function setPilotAvailabilityAction(formData: FormData) {
  await runFleetAction(
    formData,
    pilotAvailabilityInputSchema,
    ["userId", "isActive"],
    setPilotAvailability
  );
}
