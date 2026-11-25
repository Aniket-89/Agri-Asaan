// Loads MapLibre on demand, once per page, so pages without a visible map
// never download it. MapLibre 6 expects its worker beside its own module
// file, which bundling moves; scripts/copy-map-worker.mjs puts the worker in
// public/vendor/ and this points MapLibre at it.
let loading: Promise<typeof import("maplibre-gl")> | null = null;

export function loadMapLibre(): Promise<typeof import("maplibre-gl")> {
  loading ??= import("maplibre-gl").then((maplibre) => {
    maplibre.setWorkerUrl(`/vendor/maplibre-gl-worker.mjs?v=${maplibre.getVersion()}`);
    return maplibre;
  });
  return loading;
}
