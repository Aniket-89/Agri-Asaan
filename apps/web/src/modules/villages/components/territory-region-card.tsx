import type { Dictionary } from "@/lib/i18n";
import type { TerritoryOverview, TerritoryRegion } from "../territory.service";

type FormAction = (formData: FormData) => Promise<void>;

export type TerritoryActions = {
  createVillage: FormAction;
  assignRegionalAdmin: FormAction;
  removeRegionalAdmin: FormAction;
  assignMitra: FormAction;
  removeMitra: FormAction;
};

type Props = {
  region: TerritoryRegion;
  overview: TerritoryOverview;
  actions: TerritoryActions;
  t: Dictionary["territory"];
};

const inputClass = "min-h-11 w-full rounded border px-3 py-2";
const buttonClass = "min-h-11 rounded bg-black px-4 py-2 text-white";
const removeClass = "min-h-11 rounded border px-3 py-2 text-sm underline";

function AssignForm({
  action,
  hidden,
  candidates,
  placeholder,
  submit,
}: {
  action: FormAction;
  hidden: Record<string, string>;
  candidates: { id: string; name: string }[];
  placeholder: string;
  submit: string;
}) {
  if (candidates.length === 0) {
    return null;
  }
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <select
        name="userId"
        required
        defaultValue=""
        aria-label={placeholder}
        className={inputClass}
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
      <button type="submit" className={buttonClass}>
        {submit}
      </button>
    </form>
  );
}

export function TerritoryRegionCard({ region, overview, actions, t }: Props) {
  const assignedAdminIds = new Set(region.regionalAdmins.map((admin) => admin.id));

  return (
    <section className="space-y-5 rounded-xl border p-4" aria-labelledby={`region-${region.id}`}>
      <header>
        <h2 id={`region-${region.id}`} className="text-xl font-semibold">
          {region.name}
          {region.isActive ? null : (
            <span className="ml-2 text-sm font-normal">({t.inactive})</span>
          )}
        </h2>
        {region.canManage ? null : <p className="mt-1 text-sm text-gray-600">{t.readOnly}</p>}
      </header>

      <div className="space-y-2">
        <h3 className="font-medium">{t.regionalAdmins}</h3>
        {region.regionalAdmins.length === 0 ? (
          <p className="text-sm text-gray-600">{t.noRegionalAdmins}</p>
        ) : (
          <ul className="space-y-2">
            {region.regionalAdmins.map((admin) => (
              <li key={admin.id} className="flex items-center justify-between gap-2">
                <span>{admin.name}</span>
                {overview.canManageRegions ? (
                  <form action={actions.removeRegionalAdmin}>
                    <input type="hidden" name="regionId" value={region.id} />
                    <input type="hidden" name="userId" value={admin.id} />
                    <button type="submit" className={removeClass}>
                      {t.remove}
                    </button>
                  </form>
                ) : null}
              </li>
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

      <div className="space-y-3">
        <h3 className="font-medium">{t.villages}</h3>
        {region.villages.length === 0 ? (
          <p className="text-sm text-gray-600">{t.noVillages}</p>
        ) : null}
        <ul className="space-y-3">
          {region.villages.map((village) => {
            const assignedMitraIds = new Set(village.mitras.map((mitra) => mitra.id));
            return (
              <li key={village.id} className="space-y-2 rounded border p-3">
                <p className="font-medium">
                  {village.name}
                  {village.isActive ? null : (
                    <span className="ml-2 text-sm font-normal">({t.inactive})</span>
                  )}
                </p>
                <p className="text-sm text-gray-600">
                  {village.lgdCode ? `LGD ${village.lgdCode} · ` : ""}
                  {village.latitude !== null && village.longitude !== null
                    ? `${village.latitude}, ${village.longitude}`
                    : t.noPin}
                </p>
                <p className="text-sm font-medium">{t.mitras}</p>
                {village.mitras.length === 0 ? (
                  <p className="text-sm text-gray-600">{t.noMitras}</p>
                ) : null}
                <ul className="space-y-1">
                  {village.mitras.map((mitra) => (
                    <li key={mitra.id} className="flex items-center justify-between gap-2">
                      <span>{mitra.name}</span>
                      {region.canManage ? (
                        <form action={actions.removeMitra}>
                          <input type="hidden" name="villageId" value={village.id} />
                          <input type="hidden" name="userId" value={mitra.id} />
                          <button type="submit" className={removeClass}>
                            {t.remove}
                          </button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {region.canManage ? (
                  <AssignForm
                    action={actions.assignMitra}
                    hidden={{ villageId: village.id }}
                    candidates={overview.mitraCandidates.filter((c) => !assignedMitraIds.has(c.id))}
                    placeholder={t.chooseMitra}
                    submit={t.assign}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>

        {region.canManage ? (
          <form
            action={actions.createVillage}
            className="grid gap-2 rounded border border-dashed p-3 sm:grid-cols-2"
          >
            <input type="hidden" name="regionId" value={region.id} />
            <label className="sm:col-span-2">
              <span className="mb-1 block text-sm">{t.villageName}</span>
              <input name="name" required maxLength={120} className={inputClass} />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-sm">{t.lgdCode}</span>
              <input
                name="lgdCode"
                inputMode="numeric"
                pattern="[0-9]{1,10}"
                className={inputClass}
              />
            </label>
            <label>
              <span className="mb-1 block text-sm">{t.latitude}</span>
              <input
                name="latitude"
                type="number"
                step="0.000001"
                min={-90}
                max={90}
                className={inputClass}
              />
            </label>
            <label>
              <span className="mb-1 block text-sm">{t.longitude}</span>
              <input
                name="longitude"
                type="number"
                step="0.000001"
                min={-180}
                max={180}
                className={inputClass}
              />
            </label>
            <button type="submit" className={`${buttonClass} sm:col-span-2`}>
              {t.addVillage}
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
