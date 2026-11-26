import { controlClass, Field } from "@/components/ui";
import { format, type Dictionary } from "@/lib/i18n";

import type { Places } from "@/modules/places";
import { PlacePicker } from "@/modules/places/components/place-picker";

import type { SignupVillage } from "../farmer-signup.service";

// Optional: a farmer whose village is listed picks it and is placed at once;
// everyone else is placed by a regional admin from their address.
function VillageSelect({
  regions,
  t,
}: {
  regions: Map<string, SignupVillage[]>;
  t: Dictionary["register"];
}) {
  return (
    <Field label={t.village} hint={t.villageHint}>
      <select className={controlClass} name="villageId" defaultValue="">
        <option value="">{t.villageNotListed}</option>
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
  );
}

// The farmer details shared by the register form and the "finish
// registering" form: name, mobile number, address, an optional listed village,
// and the farmer's consent (ADR 0021).
export function FarmerSignupFields({
  villages,
  places,
  brandName,
  defaultName = "",
  t,
}: {
  villages: SignupVillage[];
  places: Places;
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
      <PlacePicker
        districts={places.districts}
        tehsils={places.tehsils}
        level="tehsil"
        className={controlClass}
        labels={{
          state: t.state,
          chooseState: t.chooseState,
          district: t.district,
          chooseDistrict: t.chooseDistrict,
          tehsil: t.tehsil,
          chooseTehsil: t.chooseTehsil,
          tehsilHint: t.tehsilHint,
        }}
      />
      <Field label={t.pincode} hint={t.pincodeHint}>
        <input
          className={controlClass}
          name="pincode"
          inputMode="numeric"
          autoComplete="postal-code"
          pattern="[1-9][0-9]{5}"
          maxLength={6}
          required
        />
      </Field>
      <Field label={t.locality}>
        <input
          className={controlClass}
          name="locality"
          autoComplete="address-level2"
          minLength={2}
          maxLength={120}
          required
        />
      </Field>
      <Field label={t.addressLine} hint={t.addressLineHint}>
        <input
          className={controlClass}
          name="addressLine"
          autoComplete="street-address"
          minLength={3}
          maxLength={300}
          required
        />
      </Field>
      {villages.length > 0 ? <VillageSelect regions={regions} t={t} /> : null}
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
