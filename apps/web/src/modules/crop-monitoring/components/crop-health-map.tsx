"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

import { loadMapLibre } from "@/components/maps/load-maplibre";
import { MAP_STYLE_URL, pinBounds, type GeoPolygon } from "@/lib/maps/geo";

export type ColoredCell = { ring: [number, number][]; color: string };

// The field's index map laid over the street map, so the farmer can see
// which part of the field is weaker. Until the map is ready, and on phones
// where it cannot load, the server-drawn SVG (`fallback`) shows instead.
export function CropHealthMap({
  boundary,
  cells,
  pin,
  label,
  fallback,
}: {
  boundary: GeoPolygon;
  cells: ColoredCell[];
  pin: { latitude: number; longitude: number };
  label: string;
  fallback: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const dataKey = JSON.stringify({ boundary, cells, pin });

  useEffect(() => {
    const element = container.current;
    const {
      boundary: shape,
      cells: grid,
      pin: point,
    } = JSON.parse(dataKey) as {
      boundary: GeoPolygon;
      cells: ColoredCell[];
      pin: { latitude: number; longitude: number };
    };
    const bounds = pinBounds([{ id: "field", label: "", ...point, boundary: shape }]);
    if (!element || !bounds) {
      return;
    }
    let map: MapLibreMap | undefined;
    let cancelled = false;

    async function start() {
      try {
        const maplibre = await loadMapLibre();
        if (cancelled || !element || !bounds) {
          return;
        }
        map = new maplibre.Map({
          container: element,
          style: MAP_STYLE_URL,
          bounds,
          fitBoundsOptions: { padding: { top: 32, right: 48, bottom: 56, left: 32 }, maxZoom: 18 },
          attributionControl: { compact: true },
          cooperativeGestures: true,
        });
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        const loadedMap = map;
        loadedMap.on("load", () => {
          loadedMap.addSource("index-cells", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: grid.map((cell) => ({
                type: "Feature",
                properties: { color: cell.color },
                geometry: { type: "Polygon", coordinates: [cell.ring] },
              })),
            },
          });
          loadedMap.addSource("field-outline", {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: shape },
          });
          // Cells are squares; the outline masks their ragged edge visually.
          loadedMap.addLayer({
            id: "index-cells",
            type: "fill",
            source: "index-cells",
            paint: {
              "fill-color": ["get", "color"],
              "fill-opacity": 0.85,
              "fill-antialias": false,
            },
          });
          loadedMap.addLayer({
            id: "field-outline",
            type: "line",
            source: "field-outline",
            paint: { "line-color": "#17251b", "line-width": 2.5 },
          });
          setReady(true);
        });
      } catch {
        // No WebGL: the SVG fallback stays.
      }
    }

    void start();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [dataKey]);

  return (
    <div className="relative">
      <div
        ref={container}
        role="region"
        aria-label={label}
        className={`h-80 w-full overflow-hidden rounded-xl bg-field shadow-inset ${ready ? "" : "invisible"}`}
      />
      {ready ? null : (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-field p-6">
          <div className="w-full max-w-64">{fallback}</div>
        </div>
      )}
    </div>
  );
}
