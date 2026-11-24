import { NextResponse } from "next/server";
import { z } from "zod";

import { localizedPath } from "@/lib/i18n/request-locale";
import { verifyOrganizationMembership } from "@/modules/organizations";

const selectSchema = z.object({
  organizationId: z.uuid(),
});

export async function POST(request: Request) {
  const body = await request.formData();
  const parsed = selectSchema.safeParse({
    organizationId: body.get("organizationId"),
  });

  if (!parsed.success) {
    return NextResponse.redirect(
      new URL(await localizedPath("/dashboard?error=invalid_organization"), request.url)
    );
  }

  const membership = await verifyOrganizationMembership(parsed.data.organizationId);
  if (!membership) {
    return NextResponse.redirect(
      new URL(await localizedPath("/dashboard?error=organization_not_allowed"), request.url)
    );
  }

  const response = NextResponse.redirect(new URL(await localizedPath("/dashboard"), request.url));
  response.cookies.set("agri_active_organization", membership.organization_id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}
