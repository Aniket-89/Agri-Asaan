import { z } from "zod";

export const DRONE_STATUSES = ["active", "maintenance", "retired"] as const;
export type DroneStatus = (typeof DRONE_STATUSES)[number];

const optionalUuid = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.uuid().optional()
);

export const droneInputSchema = z.object({
  // Stored upper-case so "ua-demo-01" and "UA-DEMO-01" are the same airframe.
  uid: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9-]{2,39}$/)),
  model: z.string().trim().min(1).max(80),
  homeRegionId: optionalUuid,
});

export const droneStatusInputSchema = z.object({
  droneId: z.uuid(),
  status: z.enum(DRONE_STATUSES),
});

export type DroneInput = z.infer<typeof droneInputSchema>;
export type DroneStatusInput = z.infer<typeof droneStatusInputSchema>;
