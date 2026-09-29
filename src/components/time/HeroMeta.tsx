"use client";

import { dayOfYear } from "@/lib/weather/formatters";
import { PosterButton } from "../poster/PosterButton";
import { LocalClock } from "../weather/LocalClock";
import { useMoment, useView } from "./TimeContext";

/**
 * The poster's head: a hairline, then three small blocks of plain text, as a
 * Swiss poster sets its credits: the region, the day and the hour on show
 * (the running clock while live, the hour picked on the timeline otherwise),
 * each on its own two columns of the six-column grid, a line per fact, the
 * place's coordinates and the day's number in the year dimmed under them;
 * under the hour, "Crea poster".
 * A computer's alone: a phone sets these facts under the reading (HeroMetaPhone).
 */
export function HeroMeta({
  region,
  coords,
  timezone,
  renderedAt,
  dataAt,
}: {
  region: string;
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

  return (
    <div className="grid grid-cols-6 gap-x-4 gap-y-3 border-t border-white/30 pt-3 text-caption max-lg:hidden">
      <p className="col-span-2">
        {region.split(", ").map((part) => (
          <span key={part} className="block">
            {part}
          </span>
        ))}
        {/* Latitude and longitude side by side where there is room, one over the other on a phone */}
        <span className="mt-1.5 flex flex-wrap gap-x-3 tabular-nums text-ink-muted">
          {coords.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </span>
      </p>
      <p className="col-span-2">
        <span className="block">{day}</span>
        <span className="block">{dayLabel.date}</span>
        <span className="mt-1.5 block tabular-nums text-ink-muted">{dayOfYear(frame.dayKey)}</span>
      </p>
      <div className="col-span-2">
        <HeroClock timezone={timezone} renderedAt={renderedAt} dataAt={dataAt} className="" timeClassName="tabular-nums text-ink" />
        {/* The place as a poster to keep: the map in the moment's colours, its name and coordinates */}
        <PosterButton className="mt-1.5" />
      </div>
    </div>
  );
}

/**
 * The place's facts on a phone, under the name, level with the sky beside it:
 * the place over its coordinates, in small print.
 */
export function HeroMetaPhone({
  region,
  coords,
  className = "",
}: {
  region: string;
  /** ["37,77° N", "122,42° O"] */
  coords: [string, string];
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 text-caption ${className}`}>
      <p>{region}</p>
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
 * accent colour, the day under it in small print, then "Crea poster".
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
        timeClassName="font-poster text-3xl font-light leading-none tracking-[-0.02em] tabular-nums text-accent"
      />
      <p className="text-caption">
        {day}, {dayLabel.date}
      </p>
      <PosterButton className="mt-1 self-start" />
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
