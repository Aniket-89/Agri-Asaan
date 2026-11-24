import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

export const pilotProfileInputSchema = z.object({
  userId: z.uuid(),
  homeRegionId: z.preprocess(emptyToUndefined, z.uuid().optional()),
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

export const pilotAvailabilityInputSchema = z.object({
  userId: z.uuid(),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export type PilotProfileInput = z.infer<typeof pilotProfileInputSchema>;
export type PilotAvailabilityInput = z.infer<typeof pilotAvailabilityInputSchema>;
