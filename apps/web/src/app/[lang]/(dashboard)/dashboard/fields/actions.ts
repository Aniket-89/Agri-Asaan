"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { localizedPath } from "@/lib/i18n/request-locale";
import { toPolygon } from "@/lib/maps/geo";
import { setFieldBoundary } from "@/modules/fields";
import { getActiveMembershipContext } from "@/modules/organizations";

function parseBoundary(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value === "" || value.length > 20_000) {
    return null;
  }
  try {
    return toPolygon(JSON.parse(value));
  } catch {
    return null;
  }
}

// Saves a drawn boundary (ADR 0025). The field id is bound by the page; RLS
// decides whether the caller may edit that field, and the database checks
// the shape.
export async function saveBoundaryAction(fieldId: string, formData: FormData) {
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(await localizedPath("/login"));
  }
  const id = z.uuid().safeParse(fieldId);
  if (!id.success) {
    redirect(await localizedPath("/dashboard"));
  }
  const boundary = parseBoundary(formData.get("boundary"));
  if (!boundary) {
    redirect(await localizedPath(`/dashboard/fields/${id.data}/boundary?error=invalid`));
  }
  const result = await setFieldBoundary(context, id.data, boundary);
  redirect(
    await localizedPath(
      result.ok
        ? `/dashboard/fields/${id.data}?status=boundarySaved`
        : `/dashboard/fields/${id.data}/boundary?error=${result.error}`
    )
  );
}

export async function removeBoundaryAction(fieldId: string) {
  const context = await getActiveMembershipContext();
  if (!context) {
    redirect(await localizedPath("/login"));
  }
  const id = z.uuid().safeParse(fieldId);
  if (!id.success) {
    redirect(await localizedPath("/dashboard"));
  }
  const result = await setFieldBoundary(context, id.data, null);
  redirect(
    await localizedPath(
      result.ok
        ? `/dashboard/fields/${id.data}?status=boundaryRemoved`
        : `/dashboard/fields/${id.data}/boundary?error=${result.error}`
    )
  );
}
