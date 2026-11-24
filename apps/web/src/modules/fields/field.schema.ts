import { z } from "zod";

const numberFromForm = (schema: z.ZodNumber) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
    schema
  );

export const fieldInputSchema = z.object({
  farmerId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  cropId: z.uuid(),
  // Acres with at most two decimals, matching numeric(8, 2).
  areaAcres: numberFromForm(
    z
      .number()
      .positive()
      .max(10000)
      .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
        message: "at most two decimal places",
      })
  ),
  // A pin is required: pilots and satellite analysis both need the location.
  latitude: numberFromForm(z.number().min(-90).max(90)),
  longitude: numberFromForm(z.number().min(-180).max(180)),
});

export type FieldInput = z.infer<typeof fieldInputSchema>;
