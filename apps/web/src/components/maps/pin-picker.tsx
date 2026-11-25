"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";

import { INDIA_VIEW, MAP_STYLE_URL, parseCoordinate } from "@/lib/maps/geo";

import { loadMapLibre } from "./load-maplibre";

type Props = {
  // Names of the latitude/longitude inputs in the same form. They remain the
  // source of truth (and the fallback without WebGL); the map only fills them.
  latitudeName: string;
  longitudeName: string;
  // Where to start when no pin is set yet, e.g. the farmer's village.
  center?: { latitude: number; longitude: number } | null;
  label: string;
  labels: { hint: string; loading: string; failed: string };
};

const PIN_ZOOM = 16;

// Tap the map (or drag the pin) to set a field's location. Typing in the
// inputs, or "Use my location", moves the pin too. The inputs are found
// through the surrounding form, like UseLocationButton, because Next.js can
// keep hidden copies of visited pages in the DOM.
export function PinPicker({ latitudeName, longitudeName, center, label, labels }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const centerLatitude = center?.latitude;
  const centerLongitude = center?.longitude;

  useEffect(() => {
    const element = container.current;
    const form = element?.closest("form");
    const latitudeInput = form?.elements.namedItem(latitudeName);
    const longitudeInput = form?.elements.namedItem(longitudeName);
    if (
      !element ||
      !form ||
      !(latitudeInput instanceof HTMLInputElement) ||
      !(longitudeInput instanceof HTMLInputElement)
    ) {
      return;
    }
    let map: MapLibreMap | undefined;
    let marker: Marker | undefined;
    let placeMarker: ((longitude: number, latitude: number) => void) | undefined;
    let cancelled = false;

    const readInputs = () => {
      const latitude = parseCoordinate(latitudeInput.value, 90);
      const longitude = parseCoordinate(longitudeInput.value, 180);
      return latitude === null || longitude === null ? null : { latitude, longitude };
    };
    const writeInputs = (longitude: number, latitude: number) => {
      latitudeInput.value = latitude.toFixed(6);
      longitudeInput.value = longitude.toFixed(6);
    };

    async function start() {
      try {
        const maplibre = await loadMapLibre();
        if (cancelled || !element) {
          return;
        }
        const initial = readInputs();
        const start =
          initial ??
          (centerLatitude !== undefined && centerLongitude !== undefined
            ? { latitude: centerLatitude, longitude: centerLongitude }
            : null);
        map = new maplibre.Map({
          container: element,
          style: MAP_STYLE_URL,
          center: start
            ? [start.longitude, start.latitude]
            : [INDIA_VIEW.longitude, INDIA_VIEW.latitude],
          zoom: initial ? PIN_ZOOM : start ? 14 : INDIA_VIEW.zoom,
          attributionControl: { compact: true },
          cooperativeGestures: true,
        });
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        const loadedMap = map;
        loadedMap.on("error", () => {
          if (!loadedMap.loaded()) {
            setState("failed");
          }
        });
        loadedMap.on("load", () => setState("ready"));

        placeMarker = (longitude: number, latitude: number) => {
          if (!marker) {
            marker = new maplibre.Marker({ draggable: true, color: "#1d4ed8" })
              .setLngLat([longitude, latitude])
              .addTo(loadedMap);
            marker.on("dragend", () => {
              const position = marker!.getLngLat();
              writeInputs(position.lng, position.lat);
            });
          } else {
            marker.setLngLat([longitude, latitude]);
          }
        };

        if (initial) {
          placeMarker(initial.longitude, initial.latitude);
        }
        loadedMap.on("click", (event) => {
          placeMarker?.(event.lngLat.lng, event.lngLat.lat);
          writeInputs(event.lngLat.lng, event.lngLat.lat);
        });
        // Typed coordinates or "Use my location" move the pin and the view.
        form!.addEventListener("input", onInput);
      } catch {
        if (!cancelled) {
          setState("failed");
        }
      }
    }

    function onInput(event: Event) {
      if (event.target !== latitudeInput && event.target !== longitudeInput) {
        return;
      }
      const position = readInputs();
      if (!position || !map) {
        return;
      }
      placeMarker?.(position.longitude, position.latitude);
      map.easeTo({
        center: [position.longitude, position.latitude],
        zoom: Math.max(map.getZoom(), PIN_ZOOM),
      });
    }

    void start();
    return () => {
      cancelled = true;
      form.removeEventListener("input", onInput);
      map?.remove();
    };
  }, [latitudeName, longitudeName, centerLatitude, centerLongitude]);

  return (
    <div className="space-y-1">
      <p className="text-sm text-gray-600">{labels.hint}</p>
      <div className="relative">
        <div
          ref={container}
          role="region"
          aria-label={label}
          className="h-72 w-full overflow-hidden rounded-xl border bg-gray-100"
        />
        {state !== "ready" ? (
          <p
            role="status"
            className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-gray-700"
          >
            {state === "loading" ? labels.loading : labels.failed}
          </p>
        ) : null}
      </div>
    </div>
  );
}
