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

export const mitraInviteInputSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email().max(320)),
  villageId: z.uuid(),
});

export type MitraInviteInput = z.infer<typeof mitraInviteInputSchema>;

export const regionalAdminInviteInputSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email().max(320)),
  regionId: z.uuid(),
});

export type RegionalAdminInviteInput = z.infer<typeof regionalAdminInviteInputSchema>;

// A district or tehsil a region covers (ADR 0023), by LGD code.
const lgdCode = z.preprocess(
  (value) => (typeof value === "string" ? Number(value) : value),
  z.number().int().positive()
);

export const regionDistrictSchema = z.object({ regionId: z.uuid(), districtCode: lgdCode });
export const regionTehsilSchema = z.object({ regionId: z.uuid(), subdistrictCode: lgdCode });

export type RegionDistrict = z.infer<typeof regionDistrictSchema>;
export type RegionTehsil = z.infer<typeof regionTehsilSchema>;

// A region's spraying rate per acre (ADR 0022). Empty clears it.
export const regionRateSchema = z.object({
  regionId: z.uuid(),
  ratePerAcre: z.preprocess(
    (value) => (value === "" || value === null ? null : Number(value)),
    z
      .number()
      .positive()
      .max(100000)
      .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6)
      .nullable()
  ),
});

export type RegionRate = z.infer<typeof regionRateSchema>;
