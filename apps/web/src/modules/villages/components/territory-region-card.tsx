import {
  CurrencyInrIcon,
  MapTrifoldIcon,
  HouseLineIcon,
  MapPinAreaIcon,
  ShieldCheckIcon,
  UserIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";

import {
  Badge,
  Button,
  buttonClass,
  controlClass,
  controlOnTintClass,
  Disclosure,
  Field,
} from "@/components/ui";
import { format, type Dictionary } from "@/lib/i18n";
import type { Places } from "@/modules/places";
import { PlacePicker } from "@/modules/places/components/place-picker";

import type { TerritoryOverview, TerritoryRegion } from "../territory.service";

type FormAction = (formData: FormData) => Promise<void>;

export type TerritoryActions = {
  createVillage: FormAction;
  assignRegionalAdmin: FormAction;
  removeRegionalAdmin: FormAction;
  assignMitra: FormAction;
  removeMitra: FormAction;
  addDistrict: FormAction;
  removeDistrict: FormAction;
  addTehsil: FormAction;
  removeTehsil: FormAction;
  setRate: FormAction;
};

type Props = {
  region: TerritoryRegion;
  overview: TerritoryOverview;
  places: Places | null;
  actions: TerritoryActions;
  t: Dictionary["territory"];
};

function AssignForm({
  action,
  hidden,
  candidates,
  placeholder,
  submit,
  onTint = false,
}: {
  action: FormAction;
  hidden: Record<string, string>;
  candidates: { id: string; name: string }[];
  placeholder: string;
  submit: string;
  onTint?: boolean;
}) {
  if (candidates.length === 0) {
    return null;
  }
  return (
    <form action={action} className="flex gap-2">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <select
        name="userId"
        required
        defaultValue=""
        aria-label={placeholder}
        className={`${onTint ? controlOnTintClass : controlClass} min-w-0`}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {candidates.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.name}
          </option>
        ))}
      </select>
      <Button variant="secondary" className="shrink-0">
        {submit}
      </Button>
    </form>
  );
}

// A person chip with an optional remove button.
function Person({
  name,
  remove,
  removeLabel,
}: {
  name: string;
  remove?: { action: FormAction; hidden: Record<string, string> };
  removeLabel: string;
}) {
  return (
    <li className="flex min-h-11 items-center gap-2 rounded-full bg-surface py-1 pr-1 pl-1.5 shadow-soft">
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-full bg-sky-soft text-sky"
      >
        <UserIcon weight="fill" className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{name}</span>
      {remove ? (
        <form action={remove.action}>
          {Object.entries(remove.hidden).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <button
            type="submit"
            aria-label={`${removeLabel}: ${name}`}
            title={removeLabel}
            className={`${buttonClass({ variant: "quiet", size: "sm" })} size-9 px-0 text-ink-muted hover:bg-clay-soft hover:text-clay`}
          >
            <XIcon weight="bold" className="size-4" aria-hidden />
          </button>
        </form>
      ) : null}
    </li>
  );
}

// A covered district or tehsil, with a remove button for organization admins.
function CoverageChip({
  label,
  remove,
  removeLabel,
}: {
  label: string;
  remove?: { action: FormAction; hidden: Record<string, string> };
  removeLabel: string;
}) {
  return (
    <li className="flex min-h-10 items-center gap-1 rounded-full bg-canvas py-1 pr-1 pl-3 text-sm font-semibold text-ink">
      {label}
      {remove ? (
        <form action={remove.action}>
          {Object.entries(remove.hidden).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <button
            type="submit"
            aria-label={`${removeLabel}: ${label}`}
            title={removeLabel}
            className={`${buttonClass({ variant: "quiet", size: "sm" })} size-8 px-0 text-ink-muted hover:bg-clay-soft hover:text-clay`}
          >
            <XIcon weight="bold" className="size-4" aria-hidden />
          </button>
        </form>
      ) : (
        <span className="pr-2" />
      )}
    </li>
  );
}

export function TerritoryRegionCard({ region, overview, places, actions, t }: Props) {
  const assignedAdminIds = new Set(region.regionalAdmins.map((admin) => admin.id));

  return (
    <section
      className="space-y-5 rounded-2xl bg-surface p-4 shadow-soft sm:p-6"
      aria-labelledby={`region-${region.id}`}
    >
      <header className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand"
        >
          <MapPinAreaIcon weight="duotone" className="size-7" />
        </span>
        <div className="min-w-0">
          <h2
            id={`region-${region.id}`}
            className="flex flex-wrap items-center gap-2 text-xl font-bold text-ink"
          >
            {region.name}
            {region.isActive ? null : <Badge tone="neutral">{t.inactive}</Badge>}
          </h2>
          {region.canManage ? null : <p className="text-sm text-ink-muted">{t.readOnly}</p>}
        </div>
      </header>

      <div className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <ShieldCheckIcon weight="duotone" className="size-5 text-brand" aria-hidden />
          {t.regionalAdmins}
        </h3>
        {region.regionalAdmins.length === 0 ? (
          <p className="text-sm text-ink-muted">{t.noRegionalAdmins}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {region.regionalAdmins.map((admin) => (
              <Person
                key={admin.id}
                name={admin.name}
                removeLabel={t.remove}
                remove={
                  overview.canManageRegions
                    ? {
                        action: actions.removeRegionalAdmin,
                        hidden: { regionId: region.id, userId: admin.id },
                      }
                    : undefined
                }
              />
            ))}
          </ul>
        )}
        {overview.canManageRegions ? (
          <AssignForm
            action={actions.assignRegionalAdmin}
            hidden={{ regionId: region.id }}
            candidates={overview.regionalAdminCandidates.filter((c) => !assignedAdminIds.has(c.id))}
            placeholder={t.chooseRegionalAdmin}
            submit={t.assign}
          />
        ) : null}
      </div>

      <div className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <CurrencyInrIcon weight="duotone" className="size-5 text-brand" aria-hidden />
          {t.rate}
        </h3>
        <p className="text-sm text-ink-muted">
          {region.ratePerAcre !== null
            ? format(t.ratePerAcre, {
                rate: new Intl.NumberFormat("en-IN", {
                  style: "currency",
                  currency: "INR",
                  maximumFractionDigits: 2,
                }).format(region.ratePerAcre),
              })
            : t.noRateSet}
        </p>
        {overview.canManageRegions ? (
          <form action={actions.setRate} className="flex gap-2">
            <input type="hidden" name="regionId" value={region.id} />
            <label className="min-w-0 flex-1">
              <span className="sr-only">{t.rateLabel}</span>
              <input
                name="ratePerAcre"
                type="number"
                inputMode="decimal"
                min="1"
                max="100000"
                step="0.01"
                defaultValue={region.ratePerAcre ?? ""}
                placeholder={t.rateLabel}
                className={controlClass}
              />
            </label>
            <Button variant="secondary" className="shrink-0">
              {t.saveRate}
            </Button>
          </form>
        ) : null}
      </div>

      <div className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <MapTrifoldIcon weight="duotone" className="size-5 text-brand" aria-hidden />
          {t.coverage}
        </h3>
        <p className="text-sm text-ink-muted">
          {region.districts.length === 0 && region.tehsils.length === 0
            ? t.noCoverage
            : t.coverageHint}
        </p>
        {region.districts.length + region.tehsils.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {region.districts.map((district) => (
              <CoverageChip
                key={`d${district.code}`}
                label={format(t.districtChip, { name: district.name, state: district.stateName })}
                remove={
                  overview.canManageRegions
                    ? {
                        action: actions.removeDistrict,
                        hidden: { regionId: region.id, districtCode: String(district.code) },
                      }
                    : undefined
                }
                removeLabel={t.remove}
              />
            ))}
            {region.tehsils.map((tehsil) => (
              <CoverageChip
                key={`t${tehsil.code}`}
                label={format(t.tehsilChip, { name: tehsil.name, district: tehsil.districtName })}
                remove={
                  overview.canManageRegions
                    ? {
                        action: actions.removeTehsil,
                        hidden: { regionId: region.id, subdistrictCode: String(tehsil.code) },
                      }
                    : undefined
                }
                removeLabel={t.remove}
              />
            ))}
          </ul>
        ) : null}
        {overview.canManageRegions && places ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <form action={actions.addDistrict} className="space-y-2 rounded-xl bg-canvas p-3">
              <input type="hidden" name="regionId" value={region.id} />
              {/* Remounts after each change so the picker starts empty again. */}
              <PlacePicker
                key={region.districts.map((district) => district.code).join(",")}
                districts={places.districts}
                level="district"
                className={controlOnTintClass}
                labels={{
                  state: t.state,
                  chooseState: t.chooseState,
                  district: t.district,
                  chooseDistrict: t.chooseDistrict,
                }}
              />
              <Button variant="secondary" block>
                {t.addDistrict}
              </Button>
            </form>
            <form action={actions.addTehsil} className="space-y-2 rounded-xl bg-canvas p-3">
              <input type="hidden" name="regionId" value={region.id} />
              {/* Remounts after each change so the picker starts empty again. */}
              <PlacePicker
                key={region.tehsils.map((tehsil) => tehsil.code).join(",")}
                districts={places.districts}
                tehsils={places.tehsils}
                level="tehsil"
                className={controlOnTintClass}
                labels={{
                  state: t.state,
                  chooseState: t.chooseState,
                  district: t.district,
                  chooseDistrict: t.chooseDistrict,
                  tehsil: t.addTehsil,
                  chooseTehsil: t.chooseTehsil,
                  tehsilHint: t.tehsilOverrideHint,
                }}
              />
              <Button variant="secondary" block>
                {t.addTehsil}
              </Button>
            </form>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <HouseLineIcon weight="duotone" className="size-5 text-brand" aria-hidden />
          {t.villages}
        </h3>
        {region.villages.length === 0 ? (
          <p className="text-sm text-ink-muted">{t.noVillages}</p>
        ) : null}
        <ul className="space-y-2">
          {region.villages.map((village) => {
            const assignedMitraIds = new Set(village.mitras.map((mitra) => mitra.id));
            return (
              <li key={village.id} className="space-y-3 rounded-xl bg-canvas p-3 sm:p-4">
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    {village.name}
                    {village.isActive ? null : <Badge tone="neutral">{t.inactive}</Badge>}
                  </p>
                  <p className="text-xs text-ink-faint tabular-nums">
                    {village.lgdCode ? `LGD ${village.lgdCode}, ` : ""}
                    {village.latitude !== null && village.longitude !== null
                      ? `${village.latitude}, ${village.longitude}`
                      : t.noPin}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-ink-muted">{t.mitras}</p>
                  {village.mitras.length === 0 ? (
                    <p className="text-sm text-ink-muted">{t.noMitras}</p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {village.mitras.map((mitra) => (
                        <Person
                          key={mitra.id}
                          name={mitra.name}
                          removeLabel={t.remove}
                          remove={
                            region.canManage
                              ? {
                                  action: actions.removeMitra,
                                  hidden: { villageId: village.id, userId: mitra.id },
                                }
                              : undefined
                          }
                        />
                      ))}
                    </ul>
                  )}
                  {region.canManage ? (
                    <AssignForm
                      action={actions.assignMitra}
                      hidden={{ villageId: village.id }}
                      candidates={overview.mitraCandidates.filter(
                        (c) => !assignedMitraIds.has(c.id)
                      )}
                      placeholder={t.chooseMitra}
                      submit={t.assign}
                      onTint
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        {region.canManage ? (
          <Disclosure summary={t.addVillage} open={region.villages.length === 0}>
            <form action={actions.createVillage} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="regionId" value={region.id} />
              <Field label={t.villageName}>
                <input name="name" required maxLength={120} className={controlOnTintClass} />
              </Field>
              <Field label={t.lgdCode}>
                <input
                  name="lgdCode"
                  inputMode="numeric"
                  pattern="[0-9]{1,10}"
                  className={controlOnTintClass}
                />
              </Field>
              <Field label={t.latitude}>
                <input
                  name="latitude"
                  type="number"
                  step="0.000001"
                  min={-90}
                  max={90}
                  className={controlOnTintClass}
                />
              </Field>
              <Field label={t.longitude}>
                <input
                  name="longitude"
                  type="number"
                  step="0.000001"
                  min={-180}
                  max={180}
                  className={controlOnTintClass}
                />
              </Field>
              <Button className="sm:col-span-2" block>
                {t.addVillage}
              </Button>
            </form>
          </Disclosure>
        ) : null}
      </div>
    </section>
  );
}
