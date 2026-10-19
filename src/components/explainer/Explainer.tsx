"use client";

import { DURATION, SCENES, STEPS, sceneAt, span, stepAt } from "@/lib/explainer/timeline";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Stage, type FilmCity } from "./Stage";

/** Where the film begins for each of the three steps when it is seen as three stills (less motion): near the end of the scene, where it is whole */
const STILL_AT = STEPS.map((s) => s.to - 500);

const query = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (cb: () => void) => {
  const m = window.matchMedia(query);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
/** Whether the person asked for less motion; the film is then seen as three stills they step through */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export type ExplainerLinks = { explore: string; create: string };

/**
 * "Come funziona", played: the picture (`Stage`) at a time that this clock moves. It plays from the start, can be paused,
 * jumped to any of its three steps or scrubbed, and ends on two ways in (the map, the poster). For a person who asked for
 * less motion it is not played at all: the three steps are three stills to go through at their own pace.
 */
export function Explainer({ city, links, onClose, autoplay = true }: { city: FilmCity; links: ExplainerLinks; onClose?: () => void; autoplay?: boolean }) {
  const reduced = useReducedMotion();
  const [t, setT] = useState(reduced ? STILL_AT[0] : 0);
  const [playing, setPlaying] = useState(autoplay);
  const last = useRef<number | null>(null);
  const timeRef = useRef(t);

  const seek = useCallback((ms: number) => {
    const next = Math.min(DURATION, Math.max(0, ms));
    timeRef.current = next;
    setT(next);
  }, []);

  // The clock: while playing, the time follows the browser's own frames, so the film runs at the same speed on any screen
  useEffect(() => {
    if (!playing || reduced) return;
    let frame = 0;
    last.current = null;
    const tick = (now: number) => {
      const dt = last.current === null ? 0 : Math.min(64, now - last.current);
      last.current = now;
      const next = Math.min(DURATION, timeRef.current + dt);
      timeRef.current = next;
      setT(next);
      if (next >= DURATION) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, reduced]);

  const ended = t >= DURATION - 1;
  const step = stepAt(t);
  const toggle = () => {
    if (ended) {
      seek(0);
      setPlaying(true);
    } else setPlaying((p) => !p);
  };
  const goStep = (i: number) => {
    seek(reduced ? STILL_AT[i] : STEPS[i].from + 40);
    if (!reduced) setPlaying(true);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement && e.key !== " ") return;
    if (e.key === " " && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLAnchorElement)) {
      e.preventDefault();
      if (!reduced) toggle();
    } else if (e.key === "ArrowRight" && !(e.target instanceof HTMLInputElement)) seek(t + 2000);
    else if (e.key === "ArrowLeft" && !(e.target instanceof HTMLInputElement)) seek(t - 2000);
  };

  const closing = easeEnd(span(t, SCENES[4].from + 700, SCENES[4].from + 1500));

  return (
    <div data-explainer data-time={Math.round(t)} data-playing={playing} className="flex flex-col gap-3" onKeyDown={onKey}>
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/15 bg-[#080c1a] shadow-[0_30px_90px_rgb(0_0_0/0.55)]">
        <Stage t={t} city={city} />
        {/* the way on, over the close */}
        <div className="absolute inset-x-0 bottom-[11%] flex items-center justify-center gap-4 px-4 max-sm:flex-col" style={{ opacity: closing, pointerEvents: closing > 0.6 ? "auto" : "none" }} aria-hidden={closing < 0.6}>
          <Link href={links.explore} tabIndex={closing > 0.6 ? 0 : -1} className="rounded-full bg-accent px-6 py-3 text-body font-semibold text-[#101428] transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            Esplora la mappa →
          </Link>
          <Link href={links.create} tabIndex={closing > 0.6 ? 0 : -1} className="rounded-full border border-white/35 bg-white/8 px-6 py-3 text-body font-semibold text-ink backdrop-blur transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            Crea un poster →
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {!reduced && (
          <button
            type="button"
            onClick={toggle}
            aria-label={ended ? "Rivedi" : playing ? "Pausa" : "Riproduci"}
            data-explainer-play
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-[#101428] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            {ended ? <ReplayIcon /> : playing ? <PauseIcon /> : <PlayIcon />}
          </button>
        )}

        <div className="grid min-w-0 flex-1 grid-cols-3 gap-2 sm:gap-3" role="group" aria-label="I tre passi">
          {STEPS.map((s, i) => {
            const fill = reduced ? (step === i ? 1 : 0) : span(t, s.from, s.to);
            return (
              <button key={s.id} type="button" onClick={() => goStep(i)} aria-current={step === i ? "step" : undefined} data-step={s.id} className="group min-w-0 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
                <span className="relative block h-[3px] overflow-hidden rounded-full bg-white/20">
                  <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${fill * 100}%` }} />
                </span>
                <span className={`mt-2 block truncate text-[0.6875rem] uppercase tracking-[0.16em] transition-colors ${step === i ? "text-ink" : "text-ink-muted group-hover:text-ink"}`}>{s.label}</span>
                <span className="hidden truncate text-caption text-ink-muted sm:block">{s.caption}</span>
              </button>
            );
          })}
        </div>

        {onClose && (
          <button type="button" onClick={onClose} className="shrink-0 text-body text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            Chiudi
          </button>
        )}
      </div>

      {!reduced && (
        <input
          type="range"
          min={0}
          max={DURATION}
          step={50}
          value={t}
          onChange={(e) => {
            seek(Number(e.target.value));
            setPlaying(false);
          }}
          aria-label="Posizione nel video"
          aria-valuetext={`${sceneAt(t).scene.id === "intro" || sceneAt(t).scene.id === "outro" ? "Introduzione" : STEPS[Math.max(0, step)].label}, secondo ${Math.round(t / 1000)} di ${Math.round(DURATION / 1000)}`}
          className="explainer-scrub h-5 w-full cursor-pointer"
          data-explainer-scrub
        />
      )}

      {/* The same story for a screen reader, and for anyone who cannot see the picture */}
      <ol className="sr-only">
        {STEPS.map((s) => (
          <li key={s.id}>
            {s.label}: {s.caption}
          </li>
        ))}
        <li>Condividere è un gesto naturale dopo la creazione, non un obbligo.</li>
      </ol>
    </div>
  );
}

const easeEnd = (p: number) => 1 - (1 - p) ** 3;

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="currentColor">
    <path d="M8 5.5v13l11-6.5z" />
  </svg>
);
const PauseIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="currentColor">
    <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
  </svg>
);
const ReplayIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4h4" />
  </svg>
);
