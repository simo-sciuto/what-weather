"use client";

import { fetchSummary } from "@/lib/api/summary";
import { placeHref, samePlace } from "@/lib/place";
import type { SavedPlace } from "@/lib/saved-places";
import type { PlaceSummary } from "@/types/place";
import { formatTemp } from "@/lib/weather/formatters";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePlace } from "../location/PlaceContext";

const keyOf = (p: SavedPlace) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;

/**
 * KEEP on the home page: the places kept in this browser, each as a small poster in its own sky and its own temperature
 * now, a tap opens it. The place on show can be kept from here. What is kept lives in this browser only (as the pills under
 * the search do); the posters made are downloaded or shared from Create.
 */
export function KeepPanel() {
  const { place, saved, isSaved, toggleSaved } = usePlace();
  const [summaries, setSummaries] = useState<Record<string, PlaceSummary | null>>({});

  useEffect(() => {
    let alive = true;
    for (const p of saved) {
      fetchSummary(p).then((s) => {
        if (alive) setSummaries((prev) => (prev[keyOf(p)] === s ? prev : { ...prev, [keyOf(p)]: s }));
      });
    }
    return () => {
      alive = false;
    };
  }, [saved]);

  return (
    <section data-keep-panel aria-label="Conservo il risultato" className="only-conserva data-col relative flex flex-col gap-4 pb-6 lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-2 lg:pb-10 lg:pt-6 xl:col-span-6 xl:col-start-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-ink-muted">I luoghi che conservi</p>
          <p className="mt-1 text-body text-ink-muted">{saved.length ? `${saved.length} ${saved.length === 1 ? "luogo" : "luoghi"}, ognuno nel suo cielo di adesso.` : "Ancora nessuno: conserva il luogo che stai guardando."}</p>
        </div>
        <button
          type="button"
          onClick={toggleSaved}
          data-keep-toggle
          aria-pressed={isSaved}
          className={`inline-flex items-center gap-2.5 rounded-full px-5 py-2.5 font-display text-[1rem] font-semibold transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${isSaved ? "border border-white/35 bg-white/10 text-ink" : "bg-accent text-[#101428]"}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
            <path d="M6 3h12v18l-6-4.5L6 21z" />
          </svg>
          {isSaved ? `${place.name} è conservato` : `Conserva ${place.name}`}
        </button>
      </div>

      {saved.length > 0 && (
        <ul aria-label="Luoghi conservati" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {saved.map((p) => {
            const s = summaries[keyOf(p)];
            const here = samePlace(p, place);
            const sky = s?.sky ?? ["#3b4660", "#56627d", "#7b8196"];
            return (
              <li key={keyOf(p)}>
                <Link
                  href={placeHref(p)}
                  aria-current={here ? "true" : undefined}
                  className="group relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-md border border-white/25 p-3 text-ink shadow-[0_14px_36px_rgb(0_0_0/0.3)] transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  style={{ background: `linear-gradient(180deg, ${sky[0]} 0%, ${sky[1]} 55%, ${sky[2]} 100%)` }}
                >
                  <span className="text-[0.5625rem] uppercase tracking-[0.16em] text-ink-muted">{here ? "Qui" : "Luogo"}</span>
                  <span>
                    <span className="block truncate text-[1.125rem] font-extrabold leading-none tracking-[-0.03em]">{p.name}</span>
                    <span className="mt-1 block font-display text-[2.75rem] font-bold leading-none tracking-[-0.04em] text-accent">{s ? formatTemp(s.temp) : "–"}</span>
                    <span className="mt-1 block truncate text-caption text-ink-muted">{s?.label ?? " "}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-caption text-ink-muted">I luoghi restano in questo browser. Un poster lo scarichi o lo condividi da Create.</p>
    </section>
  );
}
