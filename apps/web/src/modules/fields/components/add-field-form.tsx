import { PlusIcon } from "@phosphor-icons/react/dist/ssr";

import { PinPicker } from "@/components/maps/pin-picker";
import { UseLocationButton } from "@/components/shared/use-location-button";
import { Button, controlOnTintClass, Field } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";

import type { CropOption } from "../field.service";

// "Add a field" for a farmer: used by staff on the farmer page and by the
// farmer on their own page (ADR 0021). The database decides who may add.
// Collapsed by default once fields exist: the list is the main content.
export function AddFieldForm({
  action,
  farmerId,
  crops,
  center,
  open,
  t,
}: {
  action: (formData: FormData) => Promise<void>;
  farmerId: string;
  crops: CropOption[];
  center: { latitude: number; longitude: number } | null;
  open: boolean;
  t: Dictionary;
}) {
  return (
    <details className="group rounded-xl bg-canvas" open={open}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-semibold text-brand [&::-webkit-details-marker]:hidden">
        <PlusIcon weight="bold" className="size-5" aria-hidden />
        {t.fields.add}
      </summary>
      <form action={action} className="grid gap-4 p-4 pt-1 sm:grid-cols-2">
        <input type="hidden" name="farmerId" value={farmerId} />
        <Field label={t.fields.name} className="sm:col-span-2">
          <input name="name" required maxLength={120} className={controlOnTintClass} />
        </Field>
        <Field label={t.fields.crop}>
          <select name="cropId" required defaultValue="" className={controlOnTintClass}>
            <option value="" disabled>
              {t.fields.chooseCrop}
            </option>
            {crops.map((crop) => (
              <option key={crop.id} value={crop.id}>
                {crop.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.fields.area}>
          <input
            name="areaAcres"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            max="10000"
            required
            className={controlOnTintClass}
          />
        </Field>
        <div className="sm:col-span-2">
          <PinPicker
            latitudeName="latitude"
            longitudeName="longitude"
            center={center}
            label={t.maps.picker}
            labels={{ hint: t.maps.pickHint, loading: t.maps.loading, failed: t.maps.failed }}
          />
        </div>
        <div className="sm:col-span-2">
          <UseLocationButton
            latitudeName="latitude"
            longitudeName="longitude"
            labels={{
              idle: t.fields.useMyLocation,
              locating: t.fields.locating,
              unavailable: t.fields.locationUnavailable,
            }}
          />
        </div>
        <Field label={t.fields.latitude}>
          <input
            name="latitude"
            type="number"
            inputMode="decimal"
            step="0.000001"
            min="-90"
            max="90"
            required
            className={controlOnTintClass}
          />
        </Field>
        <Field label={t.fields.longitude}>
          <input
            name="longitude"
            type="number"
            inputMode="decimal"
            step="0.000001"
            min="-180"
            max="180"
            required
            className={controlOnTintClass}
          />
        </Field>
        <Button className="sm:col-span-2" block>
          {t.fields.submit}
        </Button>
      </form>
    </details>
  );
}
