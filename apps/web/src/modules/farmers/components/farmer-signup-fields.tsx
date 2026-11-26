import { controlClass, Field } from "@/components/ui";
import { format, type Dictionary } from "@/lib/i18n";

import type { SignupVillage } from "../farmer-signup.service";

// The farmer details shared by the register form and the "finish
// registering" form: name, mobile number, village, and the farmer's consent.
export function FarmerSignupFields({
  villages,
  brandName,
  defaultName = "",
  t,
}: {
  villages: SignupVillage[];
  brandName: string;
  defaultName?: string;
  t: Dictionary["register"];
}) {
  const regions = new Map<string, SignupVillage[]>();
  for (const village of villages) {
    regions.set(village.regionName, [...(regions.get(village.regionName) ?? []), village]);
  }

  return (
    <>
      <Field label={t.fullName}>
        <input
          className={controlClass}
          name="fullName"
          autoComplete="name"
          defaultValue={defaultName}
          minLength={2}
          maxLength={120}
          required
        />
      </Field>
      <Field label={t.phone} hint={t.phoneHint}>
        <input
          className={controlClass}
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required
        />
      </Field>
      <Field label={t.village}>
        <select className={controlClass} name="villageId" defaultValue="" required>
          <option value="" disabled>
            {t.chooseVillage}
          </option>
          {[...regions].map(([regionName, regionVillages]) =>
            regions.size > 1 ? (
              <optgroup key={regionName} label={regionName}>
                {regionVillages.map((village) => (
                  <option key={village.id} value={village.id}>
                    {village.name}
                  </option>
                ))}
              </optgroup>
            ) : (
              regionVillages.map((village) => (
                <option key={village.id} value={village.id}>
                  {village.name}
                </option>
              ))
            )
          )}
        </select>
      </Field>
      <label className="flex min-h-11 items-start gap-3 rounded-xl bg-canvas p-4">
        <input
          name="consent"
          type="checkbox"
          required
          className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]"
        />
        <span className="text-sm text-ink-muted">{format(t.consent, { brand: brandName })}</span>
      </label>
    </>
  );
}
