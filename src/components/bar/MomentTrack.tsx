"use client";

import { TIME_LABELS } from "@/constants/labels";
import { adjacentDay, momentKey } from "@/lib/weather/moment-keys";
import { momentLabel, momentOrigin } from "@/lib/weather/moment-label";
import { clamp01 } from "@/utils/math";
import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { usePlace } from "../location/PlaceContext";
import { useMoment, useTimeline, useView } from "../time/TimeContext";

/** Labels at the ends align to the ends instead of hanging over them */
const anchor = (x: number) => (x < 0.04 ? "translateX(0)" : x > 0.96 ? "translateX(-100%)" : "translateX(-50%)");

/** How many marks the track carries along its length */
const MARKS = 5;

/**
 * PARKED, not mounted (ADR-029 took the bar's moment away: the hour is chosen on the curve of the hours, WTH-317; D5 may use
 * this track for the time of day in Crea). The Momento in the bar (ADR-028): one compact track through the span on show (the next 24 hours, or the day picked in
 * the week), bound to the same moment as the curve of the hours, the week and the sky: there is no state of its own.
 * Dragging or tapping picks the hour under the finger; the keyboard moves an hour (arrows) or a day (PageUp and
 * PageDown), Home goes back to Adesso. The hit area is 44 px tall. Above it, the moment written in full, on the place's
 * own clock and with where it comes from, because an hour with no zone or no source says less than it seems.
 */
export function MomentTrack({ timezone }: { timezone: string }) {
  const { place } = usePlace();
  const { frames, view, selectDay, backToNow } = useView();
  const { timeline } = useTimeline();
  const { index, setIndex, frame, isLive } = useMoment();
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const n = frames.length;
  const dayView = view.kind === "day";

  const label = momentLabel(frame.time, timezone, place.name);
  const origin = momentOrigin({ isLive, measured: frame.measured });
  const valueText = `${isLive ? `${TIME_LABELS.now}, ` : ""}${label}${origin ? `, ${origin}` : ""}`;

  const pick = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r || n < 2) return;
    setIndex(Math.round(clamp01((clientX - r.left) / r.width) * (n - 1)));
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    pick(e.clientX);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) pick(e.clientX);
  };
  const onPointerEnd = () => {
    dragging.current = false;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const key = momentKey(e.key);
    if (!key) return;
    e.preventDefault();
    if (key.kind === "hours") setIndex(index + key.delta);
    else if (key.kind === "now") backToNow();
    else {
      const day = adjacentDay(timeline.days, view.kind === "day" ? view.key : null, key.delta);
      if (day) selectDay(day);
    }
  };

  const at = (i: number) => (n > 1 ? i / (n - 1) : 0);
  const count = Math.min(MARKS, n);
  const marks = Array.from({ length: count }, (_, k) => {
    const i = count > 1 ? Math.round((k * (n - 1)) / (count - 1)) : 0;
    const f = frames[i];
    const first = k === 0;
    const last = k === count - 1 && count > 1;
    // "Adesso" at the start of the next hours, the hour elsewhere, and the day's name where the span crosses into another
    const text =
      first && !dayView
        ? TIME_LABELS.now
        : last && f.dayKey !== frames[0].dayKey
          ? (timeline.dayLabels[f.dayKey]?.relative ?? timeline.dayLabels[f.dayKey]?.weekday.slice(0, 3) ?? String(f.hour))
          : String(f.hour).padStart(2, "0");
    return { i, text, x: at(i), now: first && !dayView && isLive };
  });

  return (
    <div className="flex min-w-0 flex-col justify-center">
      <p className="truncate text-[0.75rem] font-semibold leading-4 tabular-nums text-ink">
        {label}
        {origin && <span className="font-normal text-ink-muted"> · {origin}</span>}
      </p>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Momento"
        aria-valuemin={0}
        aria-valuemax={Math.max(n - 1, 0)}
        aria-valuenow={Math.min(index, Math.max(n - 1, 0))}
        aria-valuetext={valueText}
        data-moment-track
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
        className="relative h-11 shrink-0 cursor-pointer touch-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <div ref={track} aria-hidden="true" className="absolute inset-x-[7px] top-0 h-full">
          {marks.map((m) => (
            <span
              key={m.i}
              className={`absolute top-1 whitespace-nowrap text-[0.6875rem] font-semibold uppercase leading-4 tracking-[0.16em] tabular-nums ${m.now ? "text-accent" : "text-ink-muted"}`}
              style={{ left: `${m.x * 100}%`, transform: anchor(m.x) }}
            >
              {m.text}
            </span>
          ))}
          <div className="absolute inset-x-0 top-[2.0625rem] h-[3px] -translate-y-1/2 bg-white/40" />
          <span
            className="absolute top-[2.0625rem] size-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent transition-[left] duration-150"
            style={{ left: `${at(Math.min(index, n - 1)) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
