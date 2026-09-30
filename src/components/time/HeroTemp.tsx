"use client";

import { conditionLabel, formatTemp } from "@/lib/weather/formatters";
import { tempColor, tempGradient } from "@/lib/weather/temp-color";
import { WeatherIcon } from "../weather/WeatherIcon";
import { useMoment, useView } from "./TimeContext";

/**
 * The temperature of the moment on show, set as part of the title: the same
 * size as the place's name and on its last baseline, on the grid's last two
 * columns under the clock, but light against the name's black, and in the
 * temperature's own colour (the scale the week's bars use).
 */
export function HeroTemp() {
  const { frame } = useMoment();
  return (
    <p
      aria-hidden="true"
      className="font-poster font-light leading-[0.86] tracking-[-0.05em] whitespace-nowrap tabular-nums transition-colors duration-700"
      style={{ color: tempColor(frame.temp) }}
    >
      {formatTemp(frame.temp)}
    </p>
  );
}

/**
 * Under the temperature, on its two columns, a short stack in the text size,
 * a line per fact: the sky (its icon at the text's height); the range, low and
 * high each in its own colour, joined by a bar of the colours between them
 * (as in the week); the feels-like; while live, how now compares with the
 * same time yesterday. The range is the day's in day view and today's while
 * live; a scrubbed hour has none.
 */
export function HeroSky({
  high,
  low,
  note,
  yesterday,
  className = "",
}: {
  high: number;
  low: number;
  note?: string;
  /** "2° in meno di ieri": now against the same time yesterday */
  yesterday?: string;
  className?: string;
}) {
  const { frame, isLive } = useMoment();
  const { day } = useView();
  const range = day ? { high: day.high, low: day.low, note: "" } : isLive ? { high, low, note: note ?? "" } : null;

  return (
    <div
      aria-hidden="true"
      className={`flex flex-col gap-1 text-[0.9375rem] leading-tight font-light tabular-nums sm:text-lg ${className}`}
    >
      <p className="flex items-center gap-2">
        <WeatherIcon
          condition={frame.condition}
          night={frame.phase === "night"}
          className="size-[1.2em] shrink-0 text-ink"
          strokeWidth={1.3}
        />
        {conditionLabel(frame)}
      </p>
      {range && (
        <p className="flex items-center gap-1.5 whitespace-nowrap sm:gap-2">
          <span style={{ color: tempColor(range.low) }}>{formatTemp(range.low)}</span>
          <span className="h-0.5 max-w-14 min-w-3 flex-1 rounded-full" style={{ background: tempGradient(range.low, range.high) }} />
          <span style={{ color: tempColor(range.high) }}>{formatTemp(range.high)}</span>
        </p>
      )}
      {/* On a narrow phone the label and the value may part onto two lines rather than overflow */}
      <p>
        <span className="text-ink-muted">Percepita</span> <span className="whitespace-nowrap">{formatTemp(frame.feelsLike)}</span>
      </p>
      {isLive && yesterday && <p className="text-ink-muted">{yesterday}</p>}
      {range?.note && <p className="text-caption text-ink-muted">{range.note}</p>}
    </div>
  );
}
