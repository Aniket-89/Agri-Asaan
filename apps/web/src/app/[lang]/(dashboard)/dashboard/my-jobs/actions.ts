"use server";

import { redirect } from "next/navigation";

import { localizedPath } from "@/lib/i18n/request-locale";
import { completeJob, completeJobSchema, startJob, startJobSchema } from "@/modules/bookings";
import { getActiveMembershipContext } from "@/modules/organizations";

const JOBS_PATH = "/dashboard/my-jobs";

export async function startJobAction(formData: FormData) {
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(await localizedPath("/login"));
  }
  const parsed = startJobSchema.safeParse({ bookingId: formData.get("bookingId") });
  if (!parsed.success) {
    redirect(await localizedPath(`${JOBS_PATH}?error=invalid`));
  }
  const result = await startJob(context, parsed.data);
  redirect(
    await localizedPath(
      result.ok ? `${JOBS_PATH}?status=started` : `${JOBS_PATH}?error=${result.error}`
    )
  );
}

export async function completeJobAction(formData: FormData) {
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(await localizedPath("/login"));
  }
  const parsed = completeJobSchema.safeParse({
    bookingId: formData.get("bookingId"),
    fieldIds: formData.getAll("fieldIds"),
    acres: formData.getAll("acres"),
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) {
    redirect(await localizedPath(`${JOBS_PATH}?error=invalid_acres`));
  }
  const result = await completeJob(context, parsed.data);
  redirect(
    await localizedPath(
      result.ok
        ? `${JOBS_PATH}?tab=completed&status=completed`
        : `${JOBS_PATH}?error=${result.error}`
    )
  );
}
