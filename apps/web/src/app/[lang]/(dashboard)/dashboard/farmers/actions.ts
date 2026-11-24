"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { localizedPath } from "@/lib/i18n/request-locale";
import { farmerInputSchema, registerFarmer } from "@/modules/farmers";
import { addField, fieldInputSchema } from "@/modules/fields";
import { getActiveMembershipContext } from "@/modules/organizations";

const FARMERS_PATH = "/dashboard/farmers";

const formValues = (formData: FormData, fields: string[]) =>
  Object.fromEntries(fields.map((field) => [field, formData.get(field)]));

export async function registerFarmerAction(formData: FormData) {
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(await localizedPath("/login"));
  }

  const parsed = farmerInputSchema.safeParse(
    formValues(formData, ["id", "villageId", "fullName", "phone", "consent"])
  );
  if (!parsed.success) {
    redirect(await localizedPath(`${FARMERS_PATH}/new?error=invalid`));
  }

  const result = await registerFarmer(context, parsed.data);
  redirect(
    await localizedPath(
      result.ok ? `${FARMERS_PATH}/${result.farmerId}` : `${FARMERS_PATH}/new?error=${result.error}`
    )
  );
}

export async function addFieldAction(formData: FormData) {
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(await localizedPath("/login"));
  }

  const values = formValues(formData, [
    "farmerId",
    "name",
    "cropId",
    "areaAcres",
    "latitude",
    "longitude",
  ]);
  // Validate the farmer id on its own so a bad field entry returns the user
  // to the same farmer page; an unvalidated id never reaches a redirect.
  const farmerId = z.uuid().safeParse(values.farmerId);
  const farmerPath = farmerId.success ? `${FARMERS_PATH}/${farmerId.data}` : FARMERS_PATH;
  const parsed = fieldInputSchema.safeParse(values);
  if (!parsed.success) {
    redirect(await localizedPath(`${farmerPath}?error=invalid`));
  }

  const result = await addField(context, parsed.data);
  redirect(
    await localizedPath(
      result.ok ? `${farmerPath}?status=saved` : `${farmerPath}?error=${result.error}`
    )
  );
}
