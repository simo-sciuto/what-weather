import { visibleDays } from "@/lib/weather/days";
import { conditionLabel, formatTemp } from "@/lib/weather/formatters";
import { tempGradient } from "@/lib/weather/temp-color";
import type { WeatherData } from "@/types/weather";
import type { CSSProperties } from "react";
import { DaySelect } from "../time/DaySelect";
import { Disclosure } from "./Disclosure";
import { WeatherIcon } from "./WeatherIcon";

const POP_THRESHOLD = 0.2;
/** Days shown at first; the rest of the week opens on request. */
const SHOWN = 3;

/**
 * A bar from `a`% to `b`% of the track whose background is the track-wide
 * gradient, positioned so the bar shows exactly its own stretch of it.
 */
function slice(a: number, b: number, gradient: string): CSSProperties {
  const w = Math.max(b - a, 0.5);
  return {
    left: `${a}%`,
    width: `${w}%`,
    backgroundImage: gradient,
    backgroundSize: `${(100 / w) * 100}% 100%`,
    backgroundPosition: w >= 100 ? "0 0" : `${(a / (100 - w)) * 100}% 0`,
  };
}

export function DailyForecast({ data, className }: { data: WeatherData; className?: string }) {
  const days = visibleDays(data);
  if (days.length < 2) return null;

  const lo = Math.min(...days.map((d) => d.point.min));
  const hi = Math.max(...days.map((d) => d.point.max));
  const pos = (t: number) => ((t - lo) / (hi - lo || 1)) * 100;
  // One gradient for the whole week; each bar shows the slice of it its day spans.
  const gradient = tempGradient(lo, hi);

  /** One day's row: name and date, sky, chance of rain, and its range on the week's scale. */
  const row = ({ key, point: d, isToday, name, short: shortName, shortDate }: (typeof days)[number]) => {
    const pop = d.precipProbability >= POP_THRESHOLD ? Math.round(d.precipProbability * 100) : null;
    const label = conditionLabel(d);
    // A partial today covers only the hours left, so its range isn't the whole day's (nor the hero's 24 hours).
    const dateNote = isToday && d.partial ? "da adesso" : shortDate;
    return (
      <li key={key}>
        <DaySelect
          dayKey={key}
          isToday={isToday}
          className="grid grid-cols-[4.25rem_1.75rem_2.5rem_2rem_minmax(0,1fr)_2rem] items-center gap-x-2.5 px-2 py-2.5 @md:grid-cols-[minmax(0,8rem)_2rem_3rem_2.5rem_minmax(0,1fr)_2.5rem] @md:gap-x-4"
        >
          <span className="sr-only">
            {name}, {dateNote}: {label.toLowerCase()}, minima {formatTemp(d.min)}, massima {formatTemp(d.max)}
            {pop != null && `, ${pop}% di probabilità di precipitazioni`}.
          </span>

          <span aria-hidden="true" className="min-w-0 leading-tight">
            <span className="block truncate text-base font-semibold">
              <span className="@md:hidden">{shortName}</span>
              <span className="hidden @md:inline">{name}</span>
            </span>
            <span className="block text-xs tabular-nums text-ink-muted">{dateNote}</span>
          </span>
          <WeatherIcon condition={d.condition} colored className="size-7" />
          <span aria-hidden="true" className="flex items-center gap-1 text-xs tabular-nums text-ink-muted">
            {pop != null && (
              <>
                <span className="size-1.5 rounded-full bg-precip" />
                {pop}%
              </>
            )}
          </span>

          {/* Range across the week: where this day's low and high fall */}
          <span aria-hidden="true" className="text-right font-display text-lg tabular-nums text-ink-muted">
            {formatTemp(d.min)}
          </span>
          <span aria-hidden="true" className="relative h-1.5 rounded-full bg-rule">
            <span
              className="absolute inset-y-0 rounded-full"
              style={slice(pos(d.min), pos(d.max), gradient)}
            />
            {isToday && (
              <span
                className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-2 ring-black/30"
                style={{ left: `${pos(Math.min(Math.max(data.current.temp, lo), hi))}%` }}
              />
            )}
          </span>
          <span aria-hidden="true" className="font-display text-lg tabular-nums">
            {formatTemp(d.max)}
          </span>
        </DaySelect>
      </li>
    );
  };

  return (
    // On the sky, not in a panel: the rows themselves are the tappable surfaces.
    <div className={`on-sky reveal @container ${className ?? ""}`}>
      <ol className="-mx-2 -my-1.5">
        {days.slice(0, SHOWN).map(row)}
      </ol>
      {days.length > SHOWN && (
        // The rest of the week on request; the bars keep the whole week's scale either way.
        <Disclosure more={`Altri ${days.length - SHOWN} giorni`} less="Mostra meno" className="mt-1">
          <ol start={SHOWN + 1} className="-mx-2 -mb-1.5">
            {days.slice(SHOWN).map(row)}
          </ol>
        </Disclosure>
      )}
    </div>
  );
}
