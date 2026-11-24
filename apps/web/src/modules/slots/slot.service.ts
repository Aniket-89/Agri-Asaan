import { toDomainError, type DomainErrorCode } from "@/lib/utils/db-errors";
import type { ActiveMembershipContext } from "@/modules/organizations";
import type { SlotActiveInput, SlotInput } from "./slot.schema";

export type SlotItem = {
  id: string;
  nameEn: string;
  nameHi: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

export type SlotResult = { ok: true } | { ok: false; error: DomainErrorCode };

export function canManageSlots(role: ActiveMembershipContext["role"]): boolean {
  return role === "organization_admin";
}

export async function listSlots(context: ActiveMembershipContext): Promise<SlotItem[] | null> {
  if (!canManageSlots(context.role)) {
    return null;
  }
  const { data, error } = await context.supabase
    .from("spray_slots")
    .select("id, name_en, name_hi, start_time, end_time, is_active")
    .eq("tenant_id", context.organizationId)
    .order("sort_order")
    .order("start_time");
  if (error) {
    throw new Error("Unable to load slots.");
  }
  return data.map((slot) => ({
    id: slot.id,
    nameEn: slot.name_en,
    nameHi: slot.name_hi,
    startTime: slot.start_time.slice(0, 5),
    endTime: slot.end_time.slice(0, 5),
    isActive: slot.is_active,
  }));
}

export async function createSlot(
  context: ActiveMembershipContext,
  input: SlotInput
): Promise<SlotResult> {
  if (!canManageSlots(context.role)) {
    return { ok: false, error: "forbidden" };
  }
  const { error } = await context.supabase.from("spray_slots").insert({
    tenant_id: context.organizationId,
    name_en: input.nameEn,
    name_hi: input.nameHi,
    start_time: input.startTime,
    end_time: input.endTime,
    // Keeps slots in time order by default.
    sort_order: Number(input.startTime.replace(":", "")),
  });
  return error ? { ok: false, error: toDomainError(error) } : { ok: true };
}

export async function setSlotActive(
  context: ActiveMembershipContext,
  input: SlotActiveInput
): Promise<SlotResult> {
  if (!canManageSlots(context.role)) {
    return { ok: false, error: "forbidden" };
  }
  const { error, count } = await context.supabase
    .from("spray_slots")
    .update({ is_active: input.isActive, updated_at: new Date().toISOString() }, { count: "exact" })
    .eq("tenant_id", context.organizationId)
    .eq("id", input.slotId);
  if (error) {
    return { ok: false, error: toDomainError(error) };
  }
  return count ? { ok: true } : { ok: false, error: "not_found" };
}
