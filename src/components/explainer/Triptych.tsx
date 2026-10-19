"use client";

import { atlasHref } from "@/lib/atlas/links";
import { createHref } from "@/lib/place";
import { formatTime } from "@/lib/weather/formatters";
import { useEffect, useMemo, useState } from "react";
import { usePlace } from "../location/PlaceContext";
import { useMoment } from "../time/TimeContext";
import type { FilmCity } from "./Stage";
import { setMode, useMode, type Mode } from "./mode";
import { HowItWorks } from "./HowItWorks";
import { useGuide } from "./useGuide";

const icon = "size-[1.25rem] shrink-0";
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const GLYPHS: Record<Mode, React.ReactNode> = {
  esplora: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={icon} {...stroke}>
      <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </svg>
  ),
  crea: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={icon} {...stroke}>
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.5-1.9-.3-1 .3-2.1 1.4-2.1H17a4 4 0 0 0 4-4c0-5-4-10-9-10z" />
      <circle cx="7.5" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="7.2" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="7.2" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  conserva: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={icon} {...stroke}>
      <path d="M6 3h12v18l-6-4.5L6 21z" />
    </svg>
  ),
};

const TABS: { mode: Mode; label: string; caption: string }[] = [
  { mode: "esplora", label: "Explore", caption: "Scopro un luogo" },
  { mode: "crea", label: "Create", caption: "Creo un record" },
  { mode: "conserva", label: "Keep", caption: "Conservo il risultato" },
];

/**
 * The page's three parts, as tabs at the head of the data: EXPLORE, CREATE, KEEP. They are the page's own structure, not
 * a line of links: what is under them changes with them (the day's data, a poster of this moment, the places kept), while
 * the weather of the place stays beside, the same in all three. Sharing is not a part: it comes after creating.
 */
export function Triptych({ onGuide }: { onGuide: () => void }) {
  const mode = useMode();

  // The blocks of the page show and hide by this, in CSS
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    return () => {
      delete document.documentElement.dataset.mode;
    };
  }, [mode]);

  return (
    <div data-triptych className="flex flex-col gap-2.5">
      <div role="tablist" aria-label="Le tre parti: scopri, crea, conserva" className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/15 bg-white/6 p-1.5 shadow-[inset_0_0.5px_0_rgb(255_255_255/0.35)] backdrop-blur-[6px] sm:gap-2 sm:p-2">
        {TABS.map((t, i) => {
          const on = mode === t.mode;
          return (
            <button
              key={t.mode}
              type="button"
              role="tab"
              id={`tab-${t.mode}`}
              aria-selected={on}
              aria-controls="triptych-panel"
              data-mode-tab={t.mode}
              onClick={() => setMode(t.mode)}
              className={`group relative flex min-w-0 flex-col gap-1.5 overflow-hidden rounded-xl px-2.5 py-2.5 text-left transition-[background-color,color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-3.5 sm:py-3 ${on ? "bg-white/16 text-ink" : "text-ink-muted hover:bg-white/8 hover:text-ink"}`}
            >
              <span className="flex items-center justify-between">
                <span className={on ? "text-accent" : ""}>{GLYPHS[t.mode]}</span>
                <span aria-hidden="true" className="text-caption tabular-nums opacity-60">
                  0{i + 1}
                </span>
              </span>
              <span className="text-[0.6875rem] font-semibold uppercase leading-none tracking-[0.16em]">{t.label}</span>
              <span className="truncate text-[0.75rem] leading-tight sm:text-caption">{t.caption}</span>
              <span aria-hidden="true" className={`absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-accent transition-transform duration-300 ${on ? "scale-x-100" : "scale-x-0"}`} />
            </button>
          );
        })}
      </div>
      <button type="button" onClick={onGuide} data-how-it-works className="group inline-flex items-center gap-2.5 self-start rounded-full py-0.5 pr-2 text-left text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
        <span className="flex size-6 items-center justify-center rounded-full bg-accent text-[#101428] transition-transform group-hover:scale-110">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3" fill="currentColor">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
        </span>
        <span className="text-caption">Rivedi la guida</span>
      </button>
    </div>
  );
}

/** The tabs and, with them, the guide: shown by itself the first time, and again whenever it is asked for. It is about the place on show. */
export function TriptychWithGuide({ timezone }: { timezone: string }) {
  const { place } = usePlace();
  const { frame, isLive, dayLabel, look } = useMoment();
  const [open, setOpen] = useState(false);
  useGuide(() => setOpen(true));

  const explore = atlasHref(place);
  const create = createHref(place, isLive ? undefined : frame.time);
  const city: FilmCity = useMemo(
    () => ({
      name: place.name,
      temp: Math.round(frame.temp),
      lat: place.lat,
      lon: place.lon,
      day: `${dayLabel.relative ?? dayLabel.weekday}, ${dayLabel.date}`,
      time: formatTime(frame.time, timezone),
      sky: [look.palette.sky1, look.palette.sky2, look.palette.sky3],
    }),
    [place, frame, dayLabel, timezone, look],
  );
  return (
    <>
      <Triptych onGuide={() => setOpen(true)} />
      <HowItWorks open={open} onClose={() => setOpen(false)} city={city} links={{ explore, create }} />
    </>
  );
}
