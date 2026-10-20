"use client";

import type { AtlasEngine } from "@/lib/atlas/engine";
import { hourAt } from "@/lib/atlas/hours";
import type { TimeStore } from "@/lib/atlas/time-store";
import { NOW_SELECTION } from "@/lib/weather/instant";
import { memo, useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import { countRender } from "./atlas-test";
import { useAtlasPoint, useAtlasTime } from "./useAtlasTime";

const DAY = 24;

/** "mar 20", "mar 20, 15:00", "martedì 20 ottobre, ore 15": the instant at the place's clock */
function formats(timezone: string) {
  const day = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", timeZone: timezone });
  const time = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: timezone });
  const spoken = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", hour: "numeric", timeZone: timezone });
  const key = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: timezone });
  return {
    day: (t: number) => day.format(t * 1000),
    short: (t: number) => `${day.format(t * 1000)}, ${time.format(t * 1000)}`,
    spoken: (t: number) => spoken.format(t * 1000).replace(/ (\d{1,2})$/, ", ore $1"),
    key: (t: number) => key.format(t * 1000),
  };
}

/**
 * The time bar (WTH-344, DESIGN_SYSTEM.md "TimeBar"): the one instant the whole Atlas shows, over the hours the point
 * on show really has. "Adesso" follows the clock; any other hour is an absolute instant (ADR-019). A native range carries
 * the role, the keys (arrows an hour, Page Up and Page Down a day, Home "Adesso", End the last hour) and the spoken value;
 * tapping is enough, dragging is never needed. Moving it asks the server for nothing: the hours are already here.
 * Further than three days the track fades, the forecast being less sure there.
 */
export const TimeBar = memo(function TimeBar({ engine, store }: { engine: AtlasEngine | null; store: TimeStore | null }) {
  countRender("time");
  const point = useAtlasPoint(engine);
  const selection = useAtlasTime(store);
  const [focused, setFocused] = useState(false);
  const hours = useMemo(() => point?.hours ?? [], [point]);
  const f = useMemo(() => formats(point?.timezone ?? "Europe/Rome"), [point?.timezone]);

  const last = Math.max(0, hours.length - 1);
  const found = selection.mode === "at" && hours.length ? hourAt(hours, selection.instant) : null;
  const index = selection.mode === "now" ? 0 : found?.status === "ok" ? found.index : null;
  const ticks = useMemo(() => {
    const out: { at: number; label: string }[] = [];
    hours.forEach((h, i) => {
      if (i > 0 && f.key(h.time) !== f.key(hours[i - 1].time)) out.push({ at: i, label: f.day(h.time) });
    });
    return out;
  }, [hours, f]);

  if (!point || hours.length < 2 || !store) return null;
  const pos = (i: number) => `${(i / last) * 100}%`;
  const live = selection.mode === "now";
  const shown = index ?? 0;
  const label = live ? "Adesso" : index === null ? "Ora non disponibile" : f.short(hours[shown].time);
  const spoken = `${live ? "Adesso, " : ""}${f.spoken(hours[shown].time)}`;
  // Beyond three days the forecast is less sure: the track fades from there
  const sureUntil = Math.min(last, 3 * DAY);

  const choose = (i: number) => {
    const at = Math.min(last, Math.max(0, i));
    store.set(at === 0 ? NOW_SELECTION : { mode: "at", instant: hours[at].time });
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const keys: Record<string, number> = { PageUp: shown + DAY, PageDown: shown - DAY, Home: 0, End: last };
    if (!(e.key in keys)) return;
    e.preventDefault();
    choose(keys[e.key]);
  };

  return (
    <div
      data-atlas-time
      className="pointer-events-auto absolute inset-x-[max(1rem,env(safe-area-inset-left))] bottom-[calc(var(--dock-room)+0.5rem)] z-20 mx-auto flex max-w-[44rem] items-center gap-3 rounded-[10px] border border-white/14 bg-surface-1 px-3 py-1.5 backdrop-blur-md motion-reduce:backdrop-blur-none"
    >
      <button
        type="button"
        aria-pressed={live}
        onClick={() => choose(0)}
        className="h-8 shrink-0 rounded-full border border-white/40 px-3 text-sm font-medium text-ink transition-colors aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {live ? "Adesso" : "Torna ad adesso"}
      </button>
      <div className="relative h-11 min-w-0 flex-1">
        <div aria-hidden="true" className="absolute inset-x-0 top-[21px] h-0.5 bg-white/40" style={{ maskImage: `linear-gradient(90deg, #000 ${pos(sureUntil)}, rgb(0 0 0 / 0.35) calc(${pos(sureUntil)} + 8%))` } as CSSProperties} />
        {ticks.map((t) => (
          <span key={t.at} aria-hidden="true" className="absolute top-[26px] -translate-x-1/2 whitespace-nowrap text-xs tabular-nums text-ink-muted before:absolute before:-top-[9px] before:left-1/2 before:h-2 before:w-px before:bg-white/40" style={{ left: pos(t.at) }}>
            {t.label}
          </span>
        ))}
        <span aria-hidden="true" data-atlas-time-label className="absolute -top-1 -translate-x-1/2 whitespace-nowrap text-xs font-medium tabular-nums text-ink" style={{ left: `clamp(2.5rem, ${pos(shown)}, calc(100% - 2.5rem))` }}>
          {label}
        </span>
        <span
          aria-hidden="true"
          className={`absolute top-[14px] -ml-2 size-4 rounded-full bg-accent shadow-[0_0_0_4px_rgb(0_0_0/0.18)] ${focused ? "outline-2 outline-offset-2 outline-accent" : ""} ${index === null ? "opacity-40" : ""}`}
          style={{ left: pos(shown) }}
        />
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={shown}
          aria-label="Momento"
          aria-valuetext={`${spoken}${point.place?.place ? `, a ${point.place.place}` : ""}`}
          onChange={(e) => choose(Number(e.target.value))}
          onKeyDown={onKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="absolute inset-0 h-11 w-full cursor-pointer touch-none opacity-0"
        />
      </div>
    </div>
  );
});
