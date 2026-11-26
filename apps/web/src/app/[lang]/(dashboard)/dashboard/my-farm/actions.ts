"use server";

import { redirect } from "next/navigation";

import { localizedPath } from "@/lib/i18n/request-locale";
import { getOwnFarmer } from "@/modules/bookings";
import { addField, fieldInputSchema } from "@/modules/fields";
import { getActiveMembershipContext } from "@/modules/organizations";

const MY_FARM_PATH = "/dashboard/my-farm";

// A farmer adds a field to their own record (ADR 0021). The farmer id comes
// from the session, never from the form.
export async function addOwnFieldAction(formData: FormData) {
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(await localizedPath("/login"));
  }
  const own = await getOwnFarmer(context);
  if (!own) {
    redirect(await localizedPath(`${MY_FARM_PATH}?fieldError=forbidden`));
  }

  const parsed = fieldInputSchema.safeParse({
    farmerId: own.id,
    name: formData.get("name"),
    cropId: formData.get("cropId"),
    areaAcres: formData.get("areaAcres"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
  });
  if (!parsed.success) {
    redirect(await localizedPath(`${MY_FARM_PATH}?fieldError=invalid`));
  }

  const result = await addField(context, parsed.data);
  redirect(
    await localizedPath(
      result.ok ? `${MY_FARM_PATH}?status=fieldSaved` : `${MY_FARM_PATH}?fieldError=${result.error}`
    )
  );
}
