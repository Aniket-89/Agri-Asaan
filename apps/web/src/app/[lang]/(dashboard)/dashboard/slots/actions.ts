"use server";

import { redirect } from "next/navigation";

import { localizedPath } from "@/lib/i18n/request-locale";
import { getActiveMembershipContext } from "@/modules/organizations";
import { createSlot, setSlotActive, slotActiveInputSchema, slotInputSchema } from "@/modules/slots";

const SLOTS_PATH = "/dashboard/slots";

export async function createSlotAction(formData: FormData) {
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(await localizedPath("/login"));
  }
  const parsed = slotInputSchema.safeParse({
    nameEn: formData.get("nameEn"),
    nameHi: formData.get("nameHi"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });
  if (!parsed.success) {
    redirect(await localizedPath(`${SLOTS_PATH}?error=invalid`));
  }
  const result = await createSlot(context, parsed.data);
  redirect(
    await localizedPath(
      result.ok ? `${SLOTS_PATH}?status=saved` : `${SLOTS_PATH}?error=${result.error}`
    )
  );
}

export async function setSlotActiveAction(formData: FormData) {
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(await localizedPath("/login"));
  }
  const parsed = slotActiveInputSchema.safeParse({
    slotId: formData.get("slotId"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) {
    redirect(await localizedPath(`${SLOTS_PATH}?error=invalid`));
  }
  const result = await setSlotActive(context, parsed.data);
  redirect(
    await localizedPath(
      result.ok ? `${SLOTS_PATH}?status=saved` : `${SLOTS_PATH}?error=${result.error}`
    )
  );
}
