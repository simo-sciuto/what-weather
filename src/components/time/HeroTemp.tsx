"use client";

import { conditionLabel, formatTemp } from "@/lib/weather/formatters";
import { tempColor, tempGradient } from "@/lib/weather/temp-color";
import { WeatherIcon } from "../weather/WeatherIcon";
import { useMoment, useView } from "./TimeContext";

/**
 * The temperature of the moment on show, at the right edge of the title: 1.9 times the name's size, light,
 * and in the temperature's own colour (the scale the week's bars use). Its figures (0.727 of their size,
 * in a box that tall and no taller) end on the baseline of the name's first line, which is 1.694em from
 * the top of the block over the name (the block 0.9em, then 0.79em into the name's line), so it starts
 * 1.694 - 0.727 x 1.9 = 0.313em down, 0.165 of its own size.
 */
export function HeroTemp({
  size = "title",
}: {
  /** "phone": the headline of the phone's poster, large but held to a set size */
  size?: "title" | "phone";
}) {
  const { frame } = useMoment();
  return (
    <p
      aria-hidden="true"
      className={`display-figure tracking-[-0.03em] whitespace-nowrap tabular-nums transition-colors duration-700 ${
        size === "phone"
          ? "text-[clamp(5.5rem,27vw,7.25rem)] leading-[0.76]"
          : "mt-[0.165em] text-[1.9em] leading-[0.727]"
      }`}
      style={{ color: tempColor(frame.temp) }}
    >
      {formatTemp(frame.temp)}
    </p>
  );
}

/** The sky of the moment on show, in words ("Coperto") */
export function HeroCondition({ className = "" }: { className?: string }) {
  const { frame } = useMoment();
  return (
    <p aria-hidden="true" className={className}>
      {conditionLabel(frame)}
    </p>
  );
}

/**
 * The range on show: the day's in day view and today's while live; a scrubbed
 * hour has none.
 */
function useRange(high: number, low: number, note?: string) {
  const { isLive } = useMoment();
  const { day } = useView();
  return day
    ? { high: day.high, low: day.low, note: "" }
    : isLive
      ? { high, low, note: note ?? "" }
      : null;
}

/**
 * Over the place's name, in one tight row: the sky as a glyph in the
 * temperature's own colour with a soft shadow under it, and then the day's low and
 * high (the low, a rule of the colours between them as in the week with a mark
 * where the moment on show sits, and the high, each numeral in its own colour).
 * The range is the day's in day view and today's while live; a scrubbed hour
 * has none, and then the glyph is alone. A note on the range (a partial day) is
 * set small under the row. Sized from the title's size (it sets the font size
 * once for the whole composition): the glyph is 0.9em wide.
 */
export function HeroGlyph({
  high,
  low,
  note,
  className = "",
}: {
  high: number;
  low: number;
  note?: string;
  className?: string;
}) {
  const { frame } = useMoment();
  const range = useRange(high, low, note);
  const span = range ? range.high - range.low : 0;
  const at =
    range && span > 0
      ? Math.min(1, Math.max(0, (frame.temp - range.low) / span))
      : 0.5;

  return (
    <div aria-hidden="true" className={`font-poster tabular-nums ${className}`}>
      <div className="flex flex-wrap items-center gap-x-[0.04em] gap-y-[0.05em]">
        <WeatherIcon
          condition={frame.condition}
          night={frame.phase === "night"}
          className="size-[0.9em] shrink-0 transition-colors duration-700"
          strokeWidth={1.4}
          style={{
            color: tempColor(frame.temp),
            filter: "drop-shadow(0 0.06em 0.14em rgb(0 0 0 / 0.55))",
          }}
        />
        {range && (
          <div className="flex items-center gap-[0.4rem] text-[max(0.8125rem,0.12em)] font-medium leading-none tracking-[-0.02em]">
            <span style={{ color: tempColor(range.low) }}>
              {formatTemp(range.low)}
            </span>
            <span
              className="relative h-[3px] w-[max(3rem,0.55em)] rounded-full"
              style={{ background: tempGradient(range.low, range.high) }}
            >
              <span
                className="absolute top-1/2 size-[0.7rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_3px_rgb(12_15_37/0.45)] transition-[left] duration-700"
                style={{ left: `${at * 100}%` }}
              />
            </span>
            <span style={{ color: tempColor(range.high) }}>
              {formatTemp(range.high)}
            </span>
          </div>
        )}
      </div>
      {range?.note && (
        <p className="mt-1 text-caption font-normal leading-tight text-ink-muted">
          {range.note}
        </p>
      )}
    </div>
  );
}
