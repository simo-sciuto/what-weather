"use client";

import { dayOfYear } from "@/lib/weather/formatters";
import { tempColor } from "@/lib/weather/temp-color";
import { PosterButton } from "../poster/PosterButton";
import { LocalClock } from "../weather/LocalClock";
import { MapControls } from "../weather/MapControls";
import { useMoment, useView } from "./TimeContext";

/**
 * The poster's top line on a computer: the two actions at either end of it,
 * level with the site's search beside the poster: the place as a poster to
 * keep, and the map's layers and colours to choose. (A phone has them docked
 * to the screen instead, see HeroActionsDock.)
 */
export function HeroActions() {
  return (
    <div className="flex h-12 items-center justify-between gap-4 max-lg:hidden">
      <PosterButton />
      <MapControls />
    </div>
  );
}

/**
 * The same two actions on a phone, docked to the foot of the screen: the map
 * stays put behind the page while it scrolls, and so do the ways to make a
 * poster of it and to change it, always a tap away. They sit left of the round
 * search button that docks at the bottom right, over a veil of the night sky so
 * the page can scroll under them. A computer has them in the poster's head.
 */
export function HeroActionsDock() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-[linear-gradient(to_top,var(--popover)_60%,transparent)] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-5 pr-20 pt-10 lg:hidden">
      <div className="pointer-events-auto flex items-baseline justify-between gap-3 text-[0.9375rem]">
        <PosterButton />
        <MapControls />
      </div>
    </div>
  );
}

/**
 * The poster's head: a hairline, then three blocks set as a Swiss poster sets
 * its credits, each on two columns of the six-column grid under a small
 * label: the place (region, coordinates dimmed), the day (its name, its date,
 * its number in the year dimmed) and the hour on show (the running clock
 * while live, the hour picked on the timeline otherwise). All in the poster's
 * own grotesk, as the title. A computer's alone: a phone sets these facts
 * under the reading (HeroMetaPhone).
 */
export function HeroMeta({
  region,
  country,
  coords,
  timezone,
  renderedAt,
  dataAt,
}: {
  region: string;
  country: string;
  /** ["37,77° N", "122,42° O"] */
  coords: [string, string];
  timezone: string;
  /** Server time of this render; the clock starts here, then ticks */
  renderedAt: number;
  /** When the current reading was taken */
  dataAt: number;
}) {
  const { frame, dayLabel } = useMoment();
  const day = dayLabel.relative ?? dayLabel.weekday;
  const value = "block text-xl font-medium leading-tight tracking-[-0.02em]";
  const dim = "mt-1 block text-caption tabular-nums text-ink-muted";

  // Three blocks of one build: a label, a value, a dimmed line under it
  return (
    <div className="grid grid-cols-6 gap-x-4 border-t border-white/30 pt-2 max-lg:hidden">
      <div className="col-span-2">
        <p className="label">Luogo</p>
        <p className={`${value} mt-1.5`}>
          {region}
          {region && country && ", "}
          <Country>{country}</Country>
        </p>
        <p className={`${dim} flex flex-wrap gap-x-3`}>
          {coords.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </p>
      </div>
      <div className="col-span-2">
        <p className="label">Giorno</p>
        <p className={`${value} mt-1.5`}>
          {day}, {dayLabel.date}
        </p>
        <p className={dim}>Giorno {dayOfYear(frame.dayKey)}</p>
      </div>
      <div className="col-span-2">
        <p className="label">Ora</p>
        <HeroClock
          timezone={timezone}
          renderedAt={renderedAt}
          dataAt={dataAt}
          className="mt-1"
          timeClassName="text-4xl font-light leading-none tracking-[-0.03em] tabular-nums text-accent"
        />
      </div>
    </div>
  );
}

/** The country: bold capitals, in the temperature's colour */
function Country({ children }: { children: string }) {
  const { frame } = useMoment();
  if (!children) return null;
  return (
    <span
      className="font-bold uppercase transition-colors duration-700"
      style={{ color: tempColor(frame.temp) }}
    >
      {children}
    </span>
  );
}

/**
 * The place's facts on a phone, under the name, level with the sky beside it:
 * the place over its coordinates, in small print.
 */
export function HeroMetaPhone({
  region,
  country,
  coords,
  className = "",
}: {
  region: string;
  country: string;
  /** ["37,77° N", "122,42° O"] */
  coords: [string, string];
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-1 font-poster text-caption ${className}`}
    >
      <p>
        {region}
        {region && country && ", "}
        <Country>{country}</Country>
      </p>
      <p className="flex flex-wrap gap-x-2 tabular-nums text-ink-muted">
        {coords.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </p>
    </div>
  );
}

/**
 * The moment on a phone, over the name: the hour on show, large and in the
 * accent colour, and the day under it in small print. ("Crea poster" and the
 * map's colours are at the foot of the first screen there, see HeroReading.)
 */
export function HeroNowPhone({
  timezone,
  renderedAt,
  dataAt,
  className = "",
}: {
  timezone: string;
  /** Server time of this render; the clock starts here, then ticks */
  renderedAt: number;
  /** When the current reading was taken */
  dataAt: number;
  className?: string;
}) {
  const { dayLabel } = useMoment();
  const day = dayLabel.relative ?? dayLabel.weekday;
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <HeroClock
        timezone={timezone}
        renderedAt={renderedAt}
        dataAt={dataAt}
        className="flex items-baseline gap-x-3 [&>p]:flex [&>p]:items-baseline [&>p]:gap-x-2"
        timeClassName="font-poster text-4xl font-light leading-none tracking-[-0.03em] tabular-nums text-accent"
      />
      <p className="text-caption">
        {day}, {dayLabel.date}
      </p>
    </div>
  );
}

/**
 * The hour on show: the running clock while live, the hour picked on the
 * timeline otherwise, with the way back to now. In the head on a computer; on
 * a phone, large and in the accent colour over the name.
 */
export function HeroClock({
  timezone,
  renderedAt,
  dataAt,
  className,
  timeClassName,
}: {
  timezone: string;
  /** Server time of this render; the clock starts here, then ticks */
  renderedAt: number;
  /** When the current reading was taken */
  dataAt: number;
  className: string;
  timeClassName: string;
}) {
  const { frame, isLive } = useMoment();
  const { backToNow } = useView();
  return (
    <div className={className}>
      <LocalClock
        timezone={timezone}
        renderedAt={renderedAt}
        dataAt={dataAt}
        shownAt={isLive ? undefined : frame.time}
        seconds
        timeClassName={timeClassName}
        className="[&>span]:text-caption [&>span]:text-ink-muted"
      />
      {/* Away from now, the way back */}
      {!isLive && (
        <button
          type="button"
          onClick={backToNow}
          className="mt-0.5 block text-left text-caption text-ink-muted underline underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Torna ad adesso
        </button>
      )}
    </div>
  );
}
