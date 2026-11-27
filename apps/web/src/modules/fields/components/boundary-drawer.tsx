"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { ArrowCounterClockwiseIcon, TrashIcon } from "@phosphor-icons/react";

import { loadMapLibre } from "@/components/maps/load-maplibre";
import { Button } from "@/components/ui";
import {
  boundaryProblem,
  cornersToPolygon,
  ringAreaAcres,
  type BoundaryProblem,
  type LngLat,
} from "@/lib/maps/boundary";
import { MAP_STYLE_URL } from "@/lib/maps/geo";

type Labels = {
  map: string;
  hint: string;
  corners: string;
  area: string;
  undo: string;
  clear: string;
  save: string;
  loading: string;
  needsMap: string;
  problems: Record<BoundaryProblem, string>;
};

const FIELD_ZOOM = 17;

function shapeData(corners: LngLat[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = corners.map((corner) => ({
    type: "Feature",
    properties: {},
    geometry: { type: "Point", coordinates: corner },
  }));
  if (corners.length >= 3) {
    features.unshift({
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [[...corners, corners[0]]] },
    });
  } else if (corners.length === 2) {
    features.unshift({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: corners },
    });
  }
  return { type: "FeatureCollection", features };
}

// Tap the corners of a field, in order, to draw its boundary. The shape is
// checked as it is drawn with the same limits the database enforces; the
// database checks it again on save. Submits `boundary` (GeoJSON Polygon) in
// the surrounding form.
export function BoundaryDrawer({
  pin,
  initial,
  locale,
  labels,
}: {
  pin: { latitude: number; longitude: number };
  initial: LngLat[];
  locale: string;
  labels: Labels;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [corners, setCorners] = useState<LngLat[]>(initial);
  const pinPoint: LngLat = [pin.longitude, pin.latitude];

  useEffect(() => {
    const element = container.current;
    if (!element) {
      return;
    }
    let cancelled = false;

    async function start() {
      try {
        const maplibre = await loadMapLibre();
        if (cancelled || !element) {
          return;
        }
        const map = new maplibre.Map({
          container: element,
          style: MAP_STYLE_URL,
          center: [pin.longitude, pin.latitude],
          zoom: FIELD_ZOOM,
          attributionControl: { compact: true },
          cooperativeGestures: true,
          doubleClickZoom: false,
        });
        mapRef.current = map;
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        map.on("error", () => {
          if (!map.loaded()) {
            setState("failed");
          }
        });
        new maplibre.Marker({ color: "#2a679e", scale: 0.8 })
          .setLngLat([pin.longitude, pin.latitude])
          .addTo(map);
        map.on("load", () => {
          map.addSource("draft", { type: "geojson", data: shapeData([]) });
          map.addLayer({
            id: "draft-fill",
            type: "fill",
            source: "draft",
            filter: ["==", ["geometry-type"], "Polygon"],
            paint: { "fill-color": "#8cc63f", "fill-opacity": 0.3 },
          });
          map.addLayer({
            id: "draft-line",
            type: "line",
            source: "draft",
            filter: ["!=", ["geometry-type"], "Point"],
            paint: { "line-color": "#2e7d32", "line-width": 3 },
          });
          map.addLayer({
            id: "draft-corners",
            type: "circle",
            source: "draft",
            filter: ["==", ["geometry-type"], "Point"],
            paint: {
              "circle-radius": 7,
              "circle-color": "#ffffff",
              "circle-stroke-color": "#2e7d32",
              "circle-stroke-width": 3,
            },
          });
          setState("ready");
        });
        map.on("click", (event) => {
          setCorners((current) => [...current, [event.lngLat.lng, event.lngLat.lat]]);
        });
      } catch {
        if (!cancelled) {
          setState("failed");
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [pin.latitude, pin.longitude]);

  useEffect(() => {
    if (state !== "ready") {
      return;
    }
    const source = mapRef.current?.getSource("draft") as GeoJSONSource | undefined;
    source?.setData(shapeData(corners));
  }, [corners, state]);

  const problem = boundaryProblem(corners, pinPoint);
  const acres = ringAreaAcres(corners);
  const areaText = new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    maximumFractionDigits: 2,
  }).format(acres);

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">{labels.hint}</p>
      <div className="relative">
        <div
          ref={container}
          role="region"
          aria-label={labels.map}
          className="h-[26rem] w-full overflow-hidden rounded-xl bg-field shadow-inset"
        />
        {state !== "ready" ? (
          <p
            role="status"
            className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-ink-muted"
          >
            {state === "loading" ? labels.loading : labels.needsMap}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-ink tabular-nums" aria-live="polite">
          {labels.corners.replace("{count}", String(corners.length))}
          {corners.length >= 3 ? `, ${labels.area.replace("{area}", areaText)}` : ""}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={corners.length === 0}
            onClick={() => setCorners((current) => current.slice(0, -1))}
          >
            <ArrowCounterClockwiseIcon className="size-4" aria-hidden />
            {labels.undo}
          </Button>
          <Button
            type="button"
            variant="quiet"
            size="sm"
            disabled={corners.length === 0}
            onClick={() => setCorners([])}
          >
            <TrashIcon className="size-4" aria-hidden />
            {labels.clear}
          </Button>
        </div>
      </div>

      {problem && corners.length > 0 ? (
        <p role="alert" className="rounded-xl bg-sun-soft px-3 py-2 text-sm text-sun-ink">
          {labels.problems[problem]}
        </p>
      ) : null}

      <input
        type="hidden"
        name="boundary"
        value={problem ? "" : JSON.stringify(cornersToPolygon(corners))}
      />
      <Button type="submit" disabled={problem !== null}>
        {labels.save}
      </Button>
    </div>
  );
}
