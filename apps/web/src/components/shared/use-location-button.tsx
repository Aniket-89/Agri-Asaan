"use client";

import { useState, type MouseEvent } from "react";

type Props = {
  // Names of the inputs in the same form that receive the coordinates.
  latitudeName: string;
  longitudeName: string;
  labels: { idle: string; locating: string; unavailable: string };
};

// Fills the latitude/longitude inputs of the button's own form from the device
// GPS. Inputs are found through the form rather than by global id, because
// Next.js can keep hidden copies of previously visited pages in the DOM. The
// inputs stay editable, so the pin can still be entered or corrected by hand.
export function UseLocationButton({ latitudeName, longitudeName, labels }: Props) {
  const [state, setState] = useState<"idle" | "locating" | "unavailable">("idle");

  function locate(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form || !("geolocation" in navigator)) {
      setState("unavailable");
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const latitude = form.elements.namedItem(latitudeName);
        const longitude = form.elements.namedItem(longitudeName);
        if (latitude instanceof HTMLInputElement && longitude instanceof HTMLInputElement) {
          latitude.value = coords.latitude.toFixed(6);
          longitude.value = coords.longitude.toFixed(6);
        }
        setState("idle");
      },
      () => setState("unavailable"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={locate}
        disabled={state === "locating"}
        className="min-h-11 w-full rounded border px-4 py-2 disabled:opacity-60"
      >
        {state === "locating" ? labels.locating : labels.idle}
      </button>
      {state === "unavailable" ? (
        <p role="status" className="text-sm text-amber-800">
          {labels.unavailable}
        </p>
      ) : null}
    </div>
  );
}
