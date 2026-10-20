"use client";

import { POINT_TIMEOUT_MS } from "@/constants/atlas";
import type { Selection, SelectionStore } from "@/lib/atlas/selection";
import type { TimeStore } from "@/lib/atlas/time-store";
import { hourNear, peakOutlook, type Verdict } from "@/lib/weather/route-outlook";
import { createClock } from "@/lib/weather/clock";
import type { RouteWeather } from "@/types/route";
import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useAtlasTime } from "./useAtlasTime";

/** The marks of the four verdicts: a shape each, the colour only reinforcing it (DESIGN_SYSTEM.md "Verdict") */
function Mark({ verdict }: { verdict: Verdict }) {
  const common = { viewBox: "0 0 24 24", "aria-hidden": true, className: "size-6 shrink-0" } as const;
  if (verdict === "good") return <svg {...common}><circle cx="12" cy="12" r="9" fill="currentColor" /></svg>;
  if (verdict === "caution")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
      </svg>
    );
  if (verdict === "no") return <svg {...common}><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>;
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
      <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="currentColor">?</text>
    </svg>
  );
}

const TONE: Record<Verdict, string> = {
  good: "text-[oklch(0.86_0.1_150)]",
  caution: "text-[oklch(0.86_0.1_80)]",
  no: "text-[oklch(0.86_0.1_25)]",
  unknown: "text-[oklch(0.86_0_0)]",
};

/** What came back, and for which summit: an answer for another summit is never shown as this one's */
type Load = { key: string } & ({ status: "ready"; weather: RouteWeather } | { status: "failed" });

const keyOf = (peak: NonNullable<Selection>) => `${peak.name}|${peak.lat}|${peak.lon}`;

/** A dialog open over the map (the search) owns Escape and the keyboard */
const inDialog = (el: Element | null) => !!el?.closest("[role=dialog], dialog");

/**
 * The card of a summit (WTH-351, WTH-352, WTH-354; EXPERIENCE.md section 2): its name and height, its weather at the
 * hour of the time bar as the model estimates it at that height, and "È un buon momento per salirci?" with its reasons,
 * what is missing, how sure it is and where the numbers come from. A sheet over the foot on a phone, a column on the
 * right on a computer; not a modal: the map stays usable, Escape closes it and the keyboard goes back where it was.
 */
export const PeakCard = memo(function PeakCard({ selection, store }: { selection: SelectionStore; store: TimeStore }) {
  const peak = useSyncExternalStore(selection.subscribe, selection.get, () => null);
  const moment = useAtlasTime(store);
  const [load, setLoad] = useState<Load | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const card = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!peak) return;
    const before = document.activeElement;
    const node = card.current;
    heading.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || inDialog(document.activeElement)) return;
      selection.set(null);
    };
    window.addEventListener("keydown", onKey);
    const abort = new AbortController();
    const key = keyOf(peak);
    // Without the summit's height the model cannot be asked at it, and a valley's weather is never given as a summit's
    if (peak.ele !== null) {
      const q = new URLSearchParams({ lat: String(peak.lat), lon: String(peak.lon), ele: String(peak.ele) });
      const mock = new URLSearchParams(window.location.search).get("mock");
      if (mock) q.set("mock", mock);
      fetch(`/api/atlas/spot?${q}`, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(POINT_TIMEOUT_MS)]) })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((weather: RouteWeather) => setLoad(Array.isArray(weather?.samples) && weather.samples[0] ? { key, status: "ready", weather } : { key, status: "failed" }))
        .catch(() => !abort.signal.aborted && setLoad({ key, status: "failed" }));
    }
    return () => {
      abort.abort();
      window.removeEventListener("keydown", onKey);
      // The keyboard goes back where it was only if it was still in the card: never pulled out of where it went since
      const now = document.activeElement;
      if (!now || now === document.body || node?.contains(now)) (before as HTMLElement | null)?.focus?.();
    };
  }, [peak, selection]);

  // "Adesso" follows the clock (ADR-019): a minute's tick, never the time the card opened
  const [clock] = useState(() => createClock());
  const now = useSyncExternalStore(clock.subscribe, clock.getSnapshot, () => 0);
  const instant = moment.mode === "at" ? moment.instant : now;
  const current = peak && load?.key === keyOf(peak) ? load : null;
  const sample = current?.status === "ready" ? current.weather.samples[0] : null;
  const summit = peak?.ele ?? null;
  const outlook = useMemo(() => (sample ? peakOutlook(sample, instant, now, undefined, summit) : null), [sample, instant, now, summit]);
  if (!peak) return null;
  // The hour shown is the one the verdict read, within half an hour, or none
  const hour = sample ? hourNear(sample.hours, instant) : null;
  const height = peak.ele !== null ? `${Math.round(peak.ele)} m` : "quota non nota";

  return (
    <aside
      ref={card}
      aria-labelledby="atlas-peak-title"
      data-atlas-peak
      className="pointer-events-auto absolute inset-x-2 bottom-[calc(var(--dock-room)+7.5rem)] z-30 max-h-[50dvh] overflow-y-auto rounded-[16px] bg-surface-2 p-4 text-ink shadow-[0_8px_24px_rgb(0_0_0/0.28)] lg:inset-x-auto lg:bottom-4 lg:right-4 lg:top-[max(4.5rem,calc(env(safe-area-inset-top)+4rem))] lg:max-h-none lg:w-[24rem]"
    >
      <header className="grid grid-cols-[1fr_auto] gap-x-2">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">Cima</p>
        <h2 id="atlas-peak-title" ref={heading} tabIndex={-1} className="col-start-1 text-xl font-semibold outline-none">
          {peak.name}
        </h2>
        <p className="col-start-1 text-sm text-ink-muted">{height} · OpenStreetMap</p>
        <button
          type="button"
          aria-label="Chiudi"
          onClick={() => selection.set(null)}
          className="col-start-2 row-span-3 row-start-1 size-11 rounded-full border border-white/14 text-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          ×
        </button>
      </header>
      <hr className="my-3 border-white/14" />
      {peak.ele === null ? (
        <div data-atlas-verdict="unknown" className={`grid grid-cols-[1.75rem_1fr] items-start gap-x-2 ${TONE.unknown}`}>
          <Mark verdict="unknown" />
          <p className="text-ink">La quota della cima non è nota: senza, il meteo in vetta non si può stimare.</p>
        </div>
      ) : !current ? (
        <p aria-busy="true" className="text-sm text-ink-muted">Carico il meteo in vetta.</p>
      ) : current.status === "failed" || !outlook || !sample ? (
        <p role="status" className="text-sm">Il meteo in vetta non è arrivato. Chiudi e riprova.</p>
      ) : (
        <>
          {hour && hour.temp !== null ? (
            <p data-atlas-peak-weather className="text-sm">
              In vetta circa <span className="font-medium tabular-nums">{Math.round(hour.temp)}°</span>, stimata in quota dal modello.
            </p>
          ) : null}
          <p className="mt-3 font-semibold">È un buon momento per salirci?</p>
          <div data-atlas-verdict={outlook.verdict} className={`mt-2 grid grid-cols-[1.75rem_1fr] items-start gap-x-2 ${TONE[outlook.verdict]}`}>
            <Mark verdict={outlook.verdict} />
            <p className="font-semibold">{outlook.word}</p>
            {outlook.why ? <p className="col-start-2 text-ink">{outlook.why}</p> : null}
          </div>
          {outlook.reasons.length ? (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {outlook.reasons.map((r) => (
                <li key={r.text} className="border-t border-white/14 pt-2">
                  {r.text}
                </li>
              ))}
            </ul>
          ) : null}
          {outlook.notEvaluated.length ? <p className="mt-3 text-xs text-ink-muted">Non valutato: {outlook.notEvaluated.join(", ")}.</p> : null}
          <p className="mt-3 text-xs text-ink-muted">
            {outlook.certainty ? `Certezza: ${outlook.certainty}${outlook.indicative ? ", indicativo" : ""}. ` : ""}
            {current.weather.provenance.source === "mock" ? "Dati di esempio." : "Fonte: Open-Meteo, modello."}
          </p>
          <p className="mt-2 text-xs text-ink-muted">
            Lo stato della neve e il pericolo valanghe non li valutiamo. Non sostituisce il bollettino di ARPA Piemonte né le notizie sul sentiero.
          </p>
        </>
      )}
    </aside>
  );
});
