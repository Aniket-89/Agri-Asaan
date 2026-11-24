import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

export const pilotAvailabilityInputSchema = z.object({
  userId: z.uuid(),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export type PilotAvailabilityInput = z.infer<typeof pilotAvailabilityInputSchema>;

export const pilotInviteInputSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email().max(320)),
  homeRegionId: z.uuid(),
  licenseNumber: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9/-]{3,40}$/))
      .optional()
  ),
});

export type PilotInviteInput = z.infer<typeof pilotInviteInputSchema>;
