"use client";

import { formatCell } from "@/lib/atlas/center";
import { placeRefOf } from "@/lib/atlas/links";
import { createHref, placeHref } from "@/lib/place";
import { placeLabel } from "@/lib/atlas/place-label";
import type { AtlasEngine } from "@/lib/atlas/engine";
import { formatTime } from "@/lib/weather/formatters";
import type { CameraPort, FailureReason } from "@/types/atlas";
import Link from "next/link";
import { useMemo, useRef, useSyncExternalStore } from "react";
import { countRender } from "./atlas-test";
import { useRestingZoom } from "./useRestingZoom";

/** The title: the town and, from close, the quarter, at one size that follows the width of the screen and never takes more than two lines each */
const TITLE = "line-clamp-2 text-balance text-[clamp(1.75rem,7vw,3.25rem)] leading-[1.02] tracking-tight";
/** The page's own halo (the markers' pattern in globals.css), so the title reads over a bright or a busy map */
const TITLE_SHADOW = { textShadow: "0 0 2px color-mix(in oklab, var(--sky-1) 85%, transparent), 0 0 14px color-mix(in oklab, var(--sky-1) 80%, transparent)" } as const;

/** A way on, in the page's own manner (the home page's "Crea poster") */
const WAY = "inline-flex items-baseline gap-3 font-display text-[0.9375rem] font-medium leading-none tracking-[-0.02em] transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";

const NONE = { status: null, point: null } as const;

const WHY: Record<FailureReason, string> = {
  timeout: "Il meteo di questo punto ci mette troppo.",
  upstream: "Il meteo di questo punto non è arrivato.",
  offline: "Sei offline: il meteo di questo punto non è arrivato.",
  unknown: "Il meteo di questo punto non è arrivato.",
};

/**
 * The weather of the point the map last rested on (M4): its temperature and its sky in words, the point's coordinates
 * and its local hour, and what the numbers are, a model's reading and not a measurement, or sample data where the
 * provider is the sample (rule 7). While the map moves, waits or loads, the previous point stays on show, dimmed; if
 * the next one does not arrive it says so and offers "Riprova". It follows the engine's snapshot, which changes with the
 * status and the point, never with a frame of the movement. A screen reader hears one line, from a region that is always
 * there, when a point arrives or fails, not while the map moves. The box takes no pointer: the map is dragged through it.
 */
export function PointReading({ engine, port }: { engine: AtlasEngine | null; port: CameraPort | null }) {
  countRender("point");
  const zoom = useRestingZoom(port, engine);
  const root = useRef<HTMLElement>(null);
  const snap = useSyncExternalStore(
    (listener) => engine?.subscribe(listener) ?? (() => {}),
    () => engine?.getSnapshot() ?? NONE,
    () => NONE,
  );
  const status = snap.status;
  const point = snap.point;
  const failed = status?.failed ?? null;
  const loading = status?.phase === "loading";
  const settled = !status || status.phase === "resting";

  // The name of the place, as precise as the zoom the Atlas rests at: the same point, named finer as the map comes close
  const named = useMemo(() => placeLabel(point?.place ?? null, zoom), [point, zoom]);
  const where = named ? `${named.near ? "Vicino a " : ""}${named.name}${named.detail ? `, ${named.detail}` : ""}` : null;

  const announced = failed
    ? WHY[failed.reason]
    : point
      ? `Punto caricato: ${where ? `${where}, ` : ""}${formatCell(point.cell)}, ${Math.round(point.temp)} gradi, ${point.label}.`
      : "";

  const label = point ? (failed ? "Non aggiornato" : point.provider === "mock" ? "Dati di esempio" : "Previsione del modello") : loading ? "Carico il punto" : null;

  return (
    <section
      ref={root}
      tabIndex={-1}
      data-atlas-point={point || failed || loading ? "" : undefined}
      data-phase={status?.phase ?? "resting"}
      aria-label="Punto caricato"
      className="pointer-events-none absolute left-[max(1rem,env(safe-area-inset-left))] top-[calc(max(1rem,env(safe-area-inset-top))+3.25rem)] z-10 max-w-[min(26rem,calc(100%-2rem))] outline-none"
    >
      <p aria-live="polite" className="sr-only">
        {announced}
      </p>
      {label ? <p className="mb-1 border-t border-white/25 pt-1 text-[0.6875rem] uppercase tracking-[0.14em] text-ink-muted">{label}</p> : null}
      {point ? (
        <div aria-hidden="true" className={`transition-opacity duration-300 motion-reduce:transition-none ${settled && !failed ? "opacity-100" : "opacity-75"}`}>
          {named ? (
            <div data-atlas-place className="mb-2 text-ink" style={TITLE_SHADOW}>
              {named.near ? <p className="mb-1 text-[0.6875rem] uppercase tracking-[0.14em] text-ink-muted">Vicino a</p> : null}
              <p data-atlas-place-name className={`${TITLE} font-semibold`}>
                {named.name}
              </p>
              {named.detail ? (
                <p data-atlas-place-detail className={`${TITLE} font-normal text-ink-muted`}>
                  {named.detail}
                </p>
              ) : null}
              {named.context ? <p className="mt-1.5 text-[0.6875rem] uppercase tracking-[0.14em] text-ink-muted">{named.context.replaceAll(", ", " \u00b7 ")}</p> : null}
            </div>
          ) : null}
          <p data-atlas-point-reading className="flex items-baseline gap-3 text-ink">
            <span className="text-[2.5rem] font-semibold leading-none tabular-nums">{Math.round(point.temp)}°</span>
            <span className="text-body">{point.label}</span>
          </p>
          <p className="mt-1 text-caption tabular-nums text-ink-muted">
            {formatCell(point.cell)} · {formatTime(point.time, point.timezone)} ora locale
          </p>
        </div>
      ) : null}
      {point && !failed ? (
        // The way on from here: this place as a poster to keep, or as the weather page. A free point goes as its coordinates.
        <nav aria-label="Da qui" data-atlas-ways className="pointer-events-auto mt-3 flex flex-col items-start gap-1.5" style={TITLE_SHADOW}>
          <Link href={createHref(placeRefOf(point))} className={`${WAY} text-accent`}>
            Crea il poster <span aria-hidden="true" className="font-sans text-base font-normal text-ink-muted">→</span>
          </Link>
          <Link href={placeHref(placeRefOf(point))} className={`${WAY} text-ink`}>
            Il meteo del luogo <span aria-hidden="true" className="font-sans text-base font-normal text-ink-muted">→</span>
          </Link>
        </nav>
      ) : null}
      {failed ? (
        <div className="mt-2">
          <p className="text-caption text-ink">{WHY[failed.reason]}</p>
          <button
            type="button"
            onClick={() => {
              // The button goes away as the request starts: keep the keyboard where it was
              root.current?.focus();
              engine?.controller.retry();
            }}
            className="pointer-events-auto mt-1 text-caption text-accent underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            Riprova
          </button>
        </div>
      ) : null}
    </section>
  );
}
