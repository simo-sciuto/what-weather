"use client";
import { CONDITION_NAMES, TIME_LABELS } from "@/constants/labels";

import { areaCorners, canvasSize, drawClouds, gridArea } from "@/lib/weather/cloud-render";
import { formatDate, formatTime, localHour } from "@/lib/weather/formatters";
import { capitalize } from "@/utils/string";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMap } from "./MapContext";
import { StylizedMap, type MapOverlay } from "./StylizedMap";

/** Forecast hours played per second: the twelve hours ahead in about ten seconds. */
const HOURS_PER_SECOND = 1.2;
/** A breath on the last hour before starting over. */
const HOLD_AT_END_MS = 1200;

/**
 * The map chapter: a monochrome map with the clouds and rain forecast for
 * the hours ahead, played as an animation along a timeline that shows how
 * many hours the forecast covers. It plays by itself once in view (not with
 * reduced motion); dragging the timeline pauses it.
 */
export function MapView() {
  const { clouds: grid, timezone } = useMap();
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const figure = useRef<HTMLElement>(null);

  // A canvas for this grid, over the grid's whole area (a new place remounts the page's time state, and this with it)
  const overlay = useMemo<MapOverlay | null>(() => {
    if (!grid) return null;
    const canvas = document.createElement("canvas");
    Object.assign(canvas, canvasSize(grid));
    return { canvas, corners: areaCorners(gridArea(grid)) };
  }, [grid]);

  // Paint the moment on show
  useEffect(() => {
    const ctx = overlay?.canvas.getContext("2d");
    if (grid && ctx) drawClouds(ctx, grid, t);
  }, [grid, overlay, t]);

  // Start playing the first time the map comes into view
  useEffect(() => {
    const el = figure.current;
    if (!el || !grid || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      setPlaying(true);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [grid]);

  // Playback: advance with the clock, hold on the last hour, start over
  useEffect(() => {
    if (!playing || !grid) return;
    const last = grid.times.length - 1;
    let frame = 0;
    let prev = performance.now();
    let heldSince: number | null = null;
    const tick = (now: number) => {
      const dt = (now - prev) / 1000;
      prev = now;
      setT((cur) => {
        if (cur < last) return Math.min(last, cur + dt * HOURS_PER_SECOND);
        heldSince ??= now;
        if (now - heldSince < HOLD_AT_END_MS) return cur;
        heldSince = null;
        return 0;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, grid]);

  const last = grid ? grid.times.length - 1 : 0;
  const hour = Math.round(t);
  const pct = (i: number) => `${(i / (last || 1)) * 100}%`;

  // A mark at each local midnight, named for the day it starts: once per grid, not on every frame of the animation
  const days = useMemo(
    () =>
      grid
        ? grid.times.flatMap((ts, i) =>
            i > 0 && Math.floor(localHour(ts, timezone)) === 0
              ? [{ i, label: capitalize(formatDate(ts, timezone, { weekday: "short" })) }]
              : [],
          )
        : [],
    [grid, timezone],
  );

  // The hour on show, in words: only when the whole hour changes (the animation moves many times an hour).
  // Named by the nearest whole hour, so the day and the time always agree.
  const moment = useMemo(() => {
    if (!grid || hour === 0) return { short: TIME_LABELS.now, spoken: TIME_LABELS.now };
    const ts = grid.times[hour];
    const time = formatTime(ts, timezone);
    return {
      short: `${capitalize(formatDate(ts, timezone, { weekday: "short" }))} ${time}`,
      spoken: `${formatDate(ts, timezone, { weekday: "long" })} alle ${time}, tra ${hour} ore`,
    };
  }, [grid, hour, timezone]);

  return (
    <figure ref={figure} className="reveal">
      <StylizedMap overlay={overlay} />

      {grid && (
        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Metti in pausa l’animazione" : "Riproduci l’animazione"}
            className="glass flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 fill-current">
              {playing ? (
                <path d="M4 3h3v10H4zM9 3h3v10H9z" />
              ) : (
                <path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5Z" />
              )}
            </svg>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <p className="font-medium tabular-nums">
                {moment.short}
                {hour > 0 && <span className="ml-2 font-normal text-ink-muted">tra {hour} h</span>}
              </p>
              <p className="label">{grid.times.length} ore di previsione</p>
            </div>

            <div className="relative mt-2">
              {/* Day boundaries along the track */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-full">
                {days.map((d) => (
                  <span key={d.i} className="absolute top-0 h-full border-l border-white/25" style={{ left: pct(d.i) }}>
                    <span className="absolute left-1.5 top-[1.35rem] text-[0.6875rem] text-ink-muted">{d.label}</span>
                  </span>
                ))}
              </div>
              <input
                type="range"
                min={0}
                max={last}
                step="any"
                value={t}
                onChange={(e) => {
                  setPlaying(false);
                  setT(Number(e.target.value));
                }}
                aria-label="Ora della previsione"
                aria-valuetext={moment.spoken}
                className="relative h-5 w-full cursor-pointer accent-[var(--accent)]"
              />
            </div>
          </div>
        </div>
      )}

      <figcaption className="mt-7 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-xs text-ink-muted">
        <span aria-hidden="true" className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-white" />
          Nuvole
        </span>
        <span aria-hidden="true" className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[rgb(64_224_255)]" />
          {CONDITION_NAMES.rain}
        </span>
      </figcaption>
    </figure>
  );
}
