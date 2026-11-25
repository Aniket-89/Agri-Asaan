"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

import { MAP_STYLE_URL, pinBounds, type MapPin, type PinTone } from "@/lib/maps/geo";

import { loadMapLibre } from "./load-maplibre";

const TONE_COLORS: Record<PinTone, string> = {
  neutral: "#2a679e",
  open: "#c47d06",
  done: "#2e7d32",
};

type Props = {
  pins: MapPin[];
  // Accessible name for the map region, e.g. "Map of Ramesh's fields".
  label: string;
  labels: { loading: string; failed: string };
  heightClass?: string;
};

// Read-only map of field pins (and boundaries where recorded). It only loads
// MapLibre once scrolled into view (or once a surrounding <details> opens),
// which keeps list pages light on low-end phones. Coordinates stay visible
// as text elsewhere on each page, so the map is never the only source.
export function FieldMap({ pins, label, labels, heightClass = "h-64" }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"waiting" | "loading" | "ready" | "failed">("waiting");
  // Re-create the map only when the pins actually change.
  const pinsKey = JSON.stringify(pins);

  useEffect(() => {
    const element = container.current;
    const current: MapPin[] = JSON.parse(pinsKey);
    const bounds = pinBounds(current);
    if (!element || !bounds) {
      return;
    }
    let map: MapLibreMap | undefined;
    let cancelled = false;

    async function start() {
      setState("loading");
      try {
        const maplibre = await loadMapLibre();
        if (cancelled || !element || !bounds) {
          return;
        }
        map = new maplibre.Map({
          container: element,
          style: MAP_STYLE_URL,
          bounds,
          fitBoundsOptions: { padding: 48, maxZoom: 16 },
          attributionControl: { compact: true },
          // One finger scrolls the page; two fingers move the map.
          cooperativeGestures: true,
        });
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        const loadedMap = map;
        loadedMap.on("error", () => {
          if (!loadedMap.loaded()) {
            setState("failed");
          }
        });
        loadedMap.on("load", () => {
          const boundaries = current.filter((pin) => pin.boundary);
          if (boundaries.length > 0) {
            loadedMap.addSource("field-boundaries", {
              type: "geojson",
              data: {
                type: "FeatureCollection",
                features: boundaries.map((pin) => ({
                  type: "Feature",
                  properties: { tone: pin.tone ?? "neutral" },
                  geometry: pin.boundary!,
                })),
              },
            });
            loadedMap.addLayer({
              id: "field-boundaries-fill",
              type: "fill",
              source: "field-boundaries",
              paint: { "fill-color": TONE_COLORS.neutral, "fill-opacity": 0.2 },
            });
            loadedMap.addLayer({
              id: "field-boundaries-line",
              type: "line",
              source: "field-boundaries",
              paint: { "line-color": TONE_COLORS.neutral, "line-width": 2 },
            });
          }
          setState("ready");
        });
        for (const pin of current) {
          const popup = new maplibre.Popup({ offset: 28, closeButton: false }).setText(
            pin.detail ? `${pin.label} · ${pin.detail}` : pin.label
          );
          new maplibre.Marker({ color: TONE_COLORS[pin.tone ?? "neutral"] })
            .setLngLat([pin.longitude, pin.latitude])
            .setPopup(popup)
            .addTo(loadedMap);
        }
      } catch {
        // Typically no WebGL on the device.
        if (!cancelled) {
          setState("failed");
        }
      }
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        void start();
      }
    });
    observer.observe(element);

    return () => {
      cancelled = true;
      observer.disconnect();
      map?.remove();
    };
  }, [pinsKey]);

  if (pins.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <div
        ref={container}
        role="region"
        aria-label={label}
        className={`${heightClass} w-full overflow-hidden rounded-xl bg-field shadow-inset`}
      />
      {state === "loading" || state === "failed" ? (
        <p
          role="status"
          className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-ink-muted"
        >
          {state === "loading" ? labels.loading : labels.failed}
        </p>
      ) : null}
    </div>
  );
}
