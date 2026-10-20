"use client";

import { DEFAULT_KEPT_FORMAT, liveRecordAt, savedPlaceId } from "@/lib/keep/kept-record";
import { useState } from "react";
import { usePlace } from "../location/PlaceContext";
import { useKept } from "./useKept";

/**
 * "Conserva": keeps the place on show as a record of Adesso on this device, or takes it away (a toggle, `aria-pressed`;
 * the name stays "Conserva" and the tick says the state). It sits in the Testata of Meteo and beside the title of
 * Crea, the same logic in both. What the last press did is said in words for those who do not see the tick change.
 * The records are in the browser, so the server and the first render see none and the button is not pressed until
 * the browser has been asked (`useKept`).
 */
export function KeepButton({ className = "" }: { className?: string }) {
  const { place } = usePlace();
  const { records, keep, remove } = useKept();
  const [said, setSaid] = useState("");
  const kept = liveRecordAt(records, place);

  function toggle() {
    if (kept) {
      setSaid(remove(kept.id) ? `${place.name} tolto da Conserva.` : "Questo dispositivo non lascia salvare.");
      return;
    }
    const { lat, lon, name, region, country } = place;
    const done = keep({
      id: savedPlaceId(place),
      place: { lat, lon, name, ...(region ? { region } : {}), ...(country ? { country } : {}) },
      t: null,
      format: DEFAULT_KEPT_FORMAT,
      createdAt: Math.floor(Date.now() / 1000),
    });
    setSaid(done ? `${name} conservato.` : "Questo dispositivo non lascia salvare.");
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={Boolean(kept)}
        data-keep-button
        className={`on-sky inline-flex h-11 items-center gap-2.5 rounded-[2px] border px-4 text-[0.9375rem] font-extrabold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-pressed:border-accent border-white/70 ${className}`}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="10" r="8" className={kept ? "fill-accent stroke-accent" : ""} />
          {kept && <path d="m6.4 10.2 2.5 2.5 4.7-5" stroke="#101428" />}
        </svg>
        Conserva
      </button>
      <p aria-live="polite" data-keep-said className="sr-only">
        {said}
      </p>
    </>
  );
}
