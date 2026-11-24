import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const slotInputSchema = z
  .object({
    nameEn: z.string().trim().min(1).max(60),
    nameHi: z.string().trim().min(1).max(60),
    startTime: time,
    endTime: time,
  })
  .refine((value) => value.startTime < value.endTime, {
    message: "the slot must end after it starts",
    path: ["endTime"],
  });

export const slotActiveInputSchema = z.object({
  slotId: z.uuid(),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export type SlotInput = z.infer<typeof slotInputSchema>;
export type SlotActiveInput = z.infer<typeof slotActiveInputSchema>;
