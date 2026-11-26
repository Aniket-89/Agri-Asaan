import { z } from "zod";

// Accepts common ways people type an Indian mobile number ("+91 98765 43210",
// "098765-43210") and stores the 10-digit form the database requires.
export function normalizeIndianMobile(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const digits = value.replace(/[\s()-]/g, "");
  return digits.replace(/^(?:\+91|0091|91(?=\d{10}$)|0(?=\d{10}$))/, "");
}

export const indianMobileSchema = z.preprocess(
  normalizeIndianMobile,
  z.string().regex(/^[6-9][0-9]{9}$/)
);

export const farmerInputSchema = z.object({
  // Generated when the form is rendered, so a retried submission is idempotent.
  id: z.uuid(),
  villageId: z.uuid(),
  fullName: z.string().trim().min(1).max(120),
  phone: indianMobileSchema,
  // The farmer must have agreed to their data being stored.
  consent: z.literal("on"),
});

// Indian postal code: six digits, not starting with 0.
export const pincodeSchema = z
  .string()
  .trim()
  .regex(/^[1-9][0-9]{5}$/);

// A farmer registering themselves (ADR 0018, 0021); the consent is their own.
// The address is always required; a listed village is optional.
export const farmerSignupSchema = z.object({
  villageId: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.uuid().optional()
  ),
  fullName: z.string().trim().min(2).max(120),
  phone: indianMobileSchema,
  // LGD tehsil code; decides the region (ADR 0023).
  subdistrictCode: z.preprocess(
    (value) => (typeof value === "string" && value !== "" ? Number(value) : value),
    z.number().int().positive()
  ),
  pincode: pincodeSchema,
  locality: z.string().trim().min(2).max(120),
  addressLine: z.string().trim().min(3).max(300),
  consent: z.literal("on"),
});

export const farmerPlacementSchema = z.object({
  farmerId: z.uuid(),
  villageId: z.uuid(),
});

export const farmerSearchSchema = z.object({
  q: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : undefined),
    z.string().max(60).optional()
  ),
  // Admins can list only farmers who still need a village.
  show: z.enum(["unplaced"]).optional().catch(undefined),
});

export type FarmerInput = z.infer<typeof farmerInputSchema>;
export type FarmerSignupInput = z.infer<typeof farmerSignupSchema>;
export type FarmerPlacementInput = z.infer<typeof farmerPlacementSchema>;
