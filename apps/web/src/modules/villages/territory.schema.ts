import { z } from "zod";

// Empty form fields arrive as "" and mean "not provided".
const optionalText = (schema: z.ZodString) =>
  z.preprocess((value) => (value === "" || value === null ? undefined : value), schema.optional());

const optionalCoordinate = (min: number, max: number) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
    z.number().min(min).max(max).optional()
  );

export const regionInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const villageInputSchema = z
  .object({
    regionId: z.uuid(),
    name: z.string().trim().min(1).max(120),
    lgdCode: optionalText(
      z
        .string()
        .trim()
        .regex(/^[0-9]{1,10}$/)
    ),
    latitude: optionalCoordinate(-90, 90),
    longitude: optionalCoordinate(-180, 180),
  })
  .refine((value) => (value.latitude === undefined) === (value.longitude === undefined), {
    message: "latitude and longitude must be provided together",
    path: ["longitude"],
  });

export const regionAssignmentSchema = z.object({
  regionId: z.uuid(),
  userId: z.uuid(),
});

export const villageAssignmentSchema = z.object({
  villageId: z.uuid(),
  userId: z.uuid(),
});

export type RegionInput = z.infer<typeof regionInputSchema>;
export type VillageInput = z.infer<typeof villageInputSchema>;
export type RegionAssignment = z.infer<typeof regionAssignmentSchema>;
export type VillageAssignment = z.infer<typeof villageAssignmentSchema>;
