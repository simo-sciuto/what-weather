"use client";

import { monotonePath } from "@/lib/weather/curve";
import { formatTemp } from "@/lib/weather/formatters";
import type { BestWindow } from "@/lib/weather/best-window";
import type { Frame, Timeline } from "@/lib/weather/frames";
import { useCallback, useMemo, useRef, useState, type PointerEvent } from "react";
import { WeatherIcon } from "../weather/WeatherIcon";
import { useMoment, useTimeline, useView } from "./TimeContext";

/** Vertical band (0..1 of the plot) the curve may occupy; the top is room for labels. */
const TOP = 0.4;
const BOTTOM = 0.8;
/** A touch has to travel this far sideways (px) before it scrubs rather than scrolls. */
const SLOP = 6;
/** Beyond this many forecast points (an hourly provider), label every third. */
const MAX_MARKS = 9;

/**
 * What the curve can draw. The temperature is scaled to its own range over
 * the span; the others start from zero and reach at least `top`, so a calm
 * day's wind or a dull day's UV stays low on the plot instead of filling it.
 */
const METRICS = {
  temp: { name: "Temperatura", unit: "", value: (f: Frame) => f.temp, label: formatTemp, top: null },
  rain: {
    name: "Pioggia",
    unit: "probabilità",
    value: (f: Frame) => f.precipProbability * 100,
    label: (v: number) => `${Math.round(v)}%`,
    top: 100,
  },
  wind: { name: "Vento", unit: "km/h", value: (f: Frame) => f.windSpeed, label: (v: number) => String(Math.round(v)), top: 40 },
  uv: { name: "UV", unit: "indice", value: (f: Frame) => f.uv ?? 0, label: (v: number) => String(Math.round(v)), top: 8 },
} as const;
type Metric = keyof typeof METRICS;

const pct = (x: number) => `${x * 100}%`;
/** Labels at the edges align to them instead of hanging over. */
const anchor = (x: number) => (x < 0.04 ? "translateX(0)" : x > 0.96 ? "translateX(-100%)" : "translateX(-50%)");
/** Phones keep every other label (never the first). */
const phoneHidden = (k: number) => (k % 2 === 1 ? "max-sm:hidden" : "");

/**
 * Everything drawn from the span on show: positions, the curve of the chosen
 * metric, which points get labels, the nights, the sun events and the best hours
 * inside it. Scrubbing
 * doesn't change any of it, so it's worked out once per span (see useMemo
 * below) and each scrub only moves the marker.
 */
function geometry(frames: Frame[], dayView: boolean, sun: Timeline["sun"], best: BestWindow | null, metric: Metric) {
  const n = frames.length;
  // Frames are evenly spaced; any other moment is placed between the two around it.
  const pos = (i: number) => i / (n - 1);
  const times = frames.map((f) => f.time);
  const xOf = (t: number) => {
    if (t <= times[0]) return 0;
    if (t >= times[n - 1]) return 1;
    const i = times.findLastIndex((x) => x <= t);
    return pos(i + (t - times[i]) / (times[i + 1] - times[i]));
  };

  const { value, top } = METRICS[metric];
  const values = frames.map(value);
  const lo = top == null ? Math.min(...values) : 0;
  const hi = top == null ? Math.max(...values) : Math.max(top, ...values);
  const yOf = (v: number) => (hi === lo ? (TOP + BOTTOM) / 2 : BOTTOM - ((v - lo) / (hi - lo)) * (BOTTOM - TOP));
  const path = monotonePath(values.map((v, i) => ({ x: pos(i) * 100, y: yOf(v) * 100 })));

  // Labels, icons and times go only where the forecast has a real point, never on an interpolated hour.
  const measured = frames.flatMap((f, i) => (f.measured && !(i === 0 && !dayView) ? [i] : []));
  // An hourly provider has too many points to label: keep the round ones (every 3 hours on the clock).
  let marks = measured.length > MAX_MARKS ? measured.filter((i) => frames[i].hour % 3 === 0) : measured;
  // In "prossime 24 ore" the start is labelled "Adesso"; drop points crowding it.
  if (!dayView) marks = [0, ...marks.filter((i) => pos(i) >= 0.13)];

  const nights = sun.nights
    .filter(([a, b]) => b > times[0] && a < times[n - 1])
    .map(([a, b]) => ({ key: a, left: xOf(a), width: xOf(b) - xOf(a) }));
  const events = sun.events
    .filter((e) => e.time > times[0] && e.time < times[n - 1])
    .map((e) => ({ ...e, x: xOf(e.time) }));

  // The best hours to be outside, where they fall in this span (a single hour still gets a sliver)
  const window =
    best && best.to >= times[0] && best.from <= times[n - 1]
      ? { left: xOf(best.from), width: Math.max(xOf(best.to) - xOf(best.from), 0.02), label: best.label }
      : null;

  return { n, pos, yOf, path, marks, nights, events, window };
}

/**
 * The timeline: the next 24 hours (or the day picked in the week) as one
 * picture — a curve (the temperature, or the chance of rain, the wind or the
 * UV, as chosen under the title), sky, night, sunrise and sunset, chance of rain,
 * the best hours to be outside — and the control that moves through it. Drag anywhere on it and the sky,
 * the reading and the outlook follow. Touch scrolls the page vertically as
 * usual; only a sideways drag scrubs. A visually hidden native range input
 * carries keyboard and screen-reader use.
 */
export function TimeScrubber() {
  const { frames, day } = useView();
  const { index, setIndex, frame, isLive } = useMoment();
  const { sun, best: next, frames: all } = useTimeline().timeline;
  const [chosen, setMetric] = useState<Metric>("temp");
  // Not every provider reports UV: without it there is no such curve to offer.
  const hasUv = useMemo(() => all.some((f) => f.uv != null), [all]);
  const metric: Metric = chosen === "uv" && !hasUv ? "temp" : chosen;
  const { value, label } = METRICS[metric];
  // The day's own best hours in day view, the next 24 hours' otherwise.
  const best = day ? day.best : next;
  const plot = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number; engaged: boolean } | null>(null);
  const n = frames.length;
  const title = day ? day.name : "Prossime 24 ore";

  const g = useMemo(
    () => (n < 2 ? null : geometry(frames, day != null, sun, best, metric)),
    [frames, day, sun, best, metric, n],
  );

  // Stable across scrubs, so the handlers below don't change on every move.
  const pick = useCallback(
    (clientX: number) => {
      const r = plot.current?.getBoundingClientRect();
      if (!r) return;
      const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      setIndex(Math.round(t * (n - 1)));
    },
    [n, setIndex],
  );

  if (!g) {
    return (
      <div className="sheet on-sky">
        <p className="label">{title}</p>
        <p className="mt-2 text-sm text-ink-muted">
          Così avanti non ci sono previsioni ora per ora: questa è la sintesi della giornata.
        </p>
      </div>
    );
  }

  const { pos, yOf, path, marks, nights, events, window } = g;

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const mouse = e.pointerType === "mouse";
    gesture.current = { x: e.clientX, y: e.clientY, engaged: mouse };
    if (mouse) pick(e.clientX);
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const drag = gesture.current;
    if (!drag) return;
    const dx = Math.abs(e.clientX - drag.x);
    if (!drag.engaged && dx > SLOP && dx > Math.abs(e.clientY - drag.y)) drag.engaged = true;
    if (drag.engaged) pick(e.clientX);
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const drag = gesture.current;
    // A tap (no travel) picks the hour under the finger.
    if (drag && !drag.engaged && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) <= SLOP) pick(e.clientX);
    gesture.current = null;
  }

  const selectedX = pos(Math.min(index, n - 1));
  const selectedY = yOf(value(frame));

  return (
    <div className="sheet on-sky has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-4 has-[input:focus-visible]:outline-accent">
      <div className="flex items-baseline justify-between gap-4">
        <p className="label">{title}</p>
        {isLive ? (
          <p className="text-xs text-ink-muted">
            <span aria-hidden="true">↔ </span>Trascina per esplorare
          </p>
        ) : (
          <p className="text-sm font-medium tabular-nums">{frame.timeLabel}</p>
        )}
      </div>

      {/* What the curve draws */}
      <div role="group" aria-label="Grandezza sulla curva" className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        {(Object.keys(METRICS) as Metric[])
          .filter((m) => m !== "uv" || hasUv)
          .map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={m === metric}
              onClick={() => setMetric(m)}
              className={`rounded-sm underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                m === metric ? "font-medium text-ink underline decoration-accent decoration-2" : "text-ink-muted hover:text-ink"
              }`}
            >
              {METRICS[m].name}
            </button>
          ))}
        {METRICS[metric].unit && <span className="ml-auto text-xs text-ink-muted">{METRICS[metric].unit}</span>}
      </div>

      <div aria-hidden="true" className="mx-1">
        <div
          ref={plot}
          data-timeline-plot
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (gesture.current = null)}
          className="relative mt-2 h-28 cursor-grab touch-pan-y select-none active:cursor-grabbing lg:h-[clamp(5.5rem,13vh,7.5rem)]"
        >
          {/* Night, shaded behind everything */}
          {nights.map((night) => (
            <div
              key={night.key}
              className="absolute inset-y-0 rounded-md bg-night-band"
              style={{ left: pct(night.left), width: pct(night.width) }}
            />
          ))}

          {/* The best hours to be outside: a wash of sage, underlined */}
          {window && (
            <div
              className="absolute inset-y-0 rounded-md border-b-2 border-sage bg-sage/15"
              style={{ left: pct(window.left), width: pct(Math.min(window.width, 1 - window.left)) }}
            />
          )}

          {/* Sunrise and sunset */}
          {events.map((e) => (
            <div key={e.time} className="absolute inset-y-0" style={{ left: pct(e.x) }}>
              <div className="absolute bottom-0 top-3.5 w-px bg-rule" />
              <span
                className="absolute top-0 whitespace-nowrap text-[0.625rem] font-medium tabular-nums text-ink-muted"
                style={{ transform: anchor(e.x) }}
              >
                {e.type === "sunrise" ? "↑" : "↓"} {e.label}
              </span>
            </div>
          ))}

          {/* Chance of rain rising from the base (the curve itself, when it is the one chosen) */}
          {frames.map((f, i) =>
            metric !== "rain" && f.precipProbability >= 0.1 ? (
              <span
                key={f.time}
                className="absolute bottom-0 w-[3px] -translate-x-1/2 rounded-t-sm bg-precip/80"
                style={{ left: pct(pos(i)), height: `${Math.round(f.precipProbability * 18)}px` }}
              />
            ) : null,
          )}

          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="draw absolute inset-0 h-full w-full overflow-visible">
            <path d={path} fill="none" stroke="var(--ink-muted)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          </svg>

          {marks.map((i, k) => (
            <div key={frames[i].time} className={phoneHidden(k)}>
              <span
                className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-muted"
                style={{ left: pct(pos(i)), top: pct(yOf(value(frames[i]))) }}
              />
              <span
                className={`absolute whitespace-nowrap text-sm tabular-nums ${i === index ? "font-semibold text-ink" : "text-ink/80"}`}
                style={{ left: pct(pos(i)), top: pct(yOf(value(frames[i]))), transform: `${anchor(pos(i))} translateY(calc(-100% - 0.4rem))` }}
              >
                {label(value(frames[i]))}
              </span>
            </div>
          ))}

          {/* The moment on show: a line through the day, the sun (or moon) riding the curve */}
          <div className="pointer-events-none absolute inset-y-0 transition-[left] duration-150" style={{ left: pct(selectedX) }}>
            <div className="absolute inset-y-0 w-px -translate-x-1/2 bg-white/70" />
            <span
              className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--sun)] shadow-[0_0_14px_var(--sun)] ring-2 ring-white/25"
              style={{ top: pct(selectedY) }}
            />
          </div>
        </div>

        {/* Sky and time under each forecast point */}
        <div className="relative mt-2 h-6">
          {marks.map((i, k) => (
            <span
              key={frames[i].time}
              className={`absolute top-0 ${phoneHidden(k)}`}
              style={{ left: pct(pos(i)), transform: anchor(pos(i)) }}
            >
              <WeatherIcon condition={frames[i].condition} night={frames[i].phase === "night"} colored className="size-6" />
            </span>
          ))}
        </div>
        <div className="relative mt-1 h-4 text-xs tabular-nums text-ink-muted">
          {marks.map((i, k) => (
            <span
              key={frames[i].time}
              className={`absolute whitespace-nowrap ${i === index ? "font-medium text-ink" : ""} ${phoneHidden(k)}`}
              style={{ left: pct(pos(i)), transform: anchor(pos(i)) }}
            >
              {frames[i].timeLabel}
            </span>
          ))}
        </div>
      </div>

      {/* The wash's legend, and the answer in words */}
      {window && (
        <p className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
          <span aria-hidden="true" className="h-2.5 w-4 shrink-0 rounded-sm border-b-2 border-sage bg-sage/30" />
          <span>
            Momento migliore: <span className="font-medium text-ink">{window.label}</span>
          </span>
        </p>
      )}

      <input
        type="range"
        min={0}
        max={n - 1}
        step={1}
        value={index}
        onChange={(e) => setIndex(Number(e.target.value))}
        aria-label={day ? `Ora da mostrare, ${day.name.toLowerCase()}` : "Ora da mostrare"}
        aria-valuetext={`${frame.timeLabel}: ${frame.summary}`}
        className="sr-only"
      />
    </div>
  );
}
