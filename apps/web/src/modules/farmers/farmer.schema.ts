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

export const farmerSearchSchema = z.object({
  q: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : undefined),
    z.string().max(60).optional()
  ),
});

export type FarmerInput = z.infer<typeof farmerInputSchema>;
