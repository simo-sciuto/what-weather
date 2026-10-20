import { TIME_LABELS } from "@/constants/labels";
import {
  conditionLabel,
  formatCoords,
  formatTemp,
  placeParts,
} from "@/lib/weather/formatters";
import type { TempRange } from "@/lib/weather/today";
import { yesterdayWords } from "@/lib/weather/yesterday";
import type { CurrentWeather, Place } from "@/types/weather";
import type { ReactNode } from "react";
import { KeepButton } from "../keep/KeepButton";
import { LocationControl } from "../location/LocationControl";
import {
  HeroActions,
  HeroMeta,
  HeroMetaPhone,
  HeroNowPhone,
} from "../time/HeroMeta";
import { NarrativeText } from "../time/NarrativeText";
import { HeroCondition, HeroGlyph, HeroTemp } from "../time/HeroTemp";

/** The width of a letter of the name (Inter Tight, heavy) and of a figure of the temperature (Syne), in the title's em */
const NAME_EM = 0.58;
const TEMP_EM = 0.72;

/**
 * The reading as a Swiss typographic poster, on a six-column grid, flush left
 * and ragged right. From the top: the two actions; then one composition: the
 * place's name heavy, the temperature bold against it on one baseline, and
 * over the name the day's low and high and the sky as a glyph in one row; an
 * empty field where the map shows the city; and at the foot one line, the
 * place, the day and the hour, with the coordinates and the day of the year as
 * small print. No sentences are set (WTH-181): the outlook is read out only.
 */
export function WeatherHero({
  place,
  timezone,
  current,
  range,
  renderedAt,
  outlook,
  yesterday,
  unavailable,
  identity,
}: {
  place: Place;
  timezone: string;
  current: CurrentWeather;
  range: TempRange;
  /** Server time of this render; the clock starts here, then ticks */
  renderedAt: number;
  outlook: string;
  /** Degrees gained or lost since the same time yesterday; null when unknown */
  yesterday: number | null;
  /** The address asked for an hour the forecast does not hold: the hour as asked (on the place's clock), if it was one */
  unavailable?: { asked: string | null };
  /** What the place is, in a line (the Territory's facts, streamed in); absent when nothing is known */
  identity?: ReactNode;
}) {
  const label = conditionLabel(current);
  const sinceYesterday =
    yesterday == null ? undefined : yesterdayWords(yesterday);
  const longest = Math.max(
    ...place.name.split(/\s+/).map((word) => word.length),
  );
  // The temperature sits right of the name, 1.9 times its size, a semibold figure at about 0.58em: its
  // longest reading of the day, sign and degree included, must fit beside the name's longest word.
  const widestTemp = Math.max(
    ...[current.temp, range.min, range.max].map((t) => formatTemp(t).length),
  );
  // The whole width is 100 units, 96 of them kept for the line, so no word ever breaks onto a second
  // line. A heavy grotesk runs about 0.58em a letter (NAME_EM); the temperature's Syne figure about 0.72em at 1.9
  // times the name's size (TEMP_EM).
  const titleSize = Math.min(
    15,
    96 / (NAME_EM * longest + TEMP_EM * 1.9 * widestTemp + 0.1),
    place.name.length > 20 ? 8 : 15,
  );

  return (
    // The map behind the page centres the city on the middle of this poster (see MapBackdropGL).
    // On a phone it fills what the screen leaves under the head (7.5rem: the wordmark, the random city
    // and the gaps): the temperature at its top, the name and the outlook at its foot, the city between.
    <section
      data-map-anchor="poster"
      aria-label="Meteo attuale"
      className="on-sky flex min-h-[calc(100svh-7.5rem)] flex-col lg:min-h-full"
    >
      <HeroActions />

      {/*
        On a phone (the poster is the whole screen there, the data in a sheet): the temperature large at
        the top, as the poster's headline, with the sky and the day's low and high under it; the map in
        the middle; the hour, the place's name and its facts at the foot, over the outlook.
      */}
      <div className="rise-in pt-4 lg:hidden">
        <div
          style={{
            fontSize: `min(4.25rem, ${(92 / (NAME_EM * longest)).toFixed(2)}vw)`,
          }}
        >
          <LocationControl />
        </div>
        <HeroTemp size="phone" />
        <div className="mt-3 flex items-center gap-3 text-[1.5rem]">
          <HeroGlyph high={range.max} low={range.min} note={range.note} />
          <HeroCondition className="text-[0.8125rem] text-ink-muted" />
        </div>
      </div>

      {/*
        On a computer the composition: over the name, close to it, the day's low and high with the sky's
        glyph; the temperature at the right edge, 1.9 times its size and ending on the baseline of the
        name's first line (see HeroTemp), so it is the largest thing on the poster. The name sets the
        size, the temperature follows it, and both step down together for a long name.
      */}
      <div
        className="mt-5 flex items-start justify-between gap-x-[0.08em] max-lg:hidden"
        style={{
          fontSize: `max(2rem, min(${titleSize}cqw, ${titleSize * 0.85}cqh))`,
        }}
      >
        <div className="min-w-0">
          <HeroGlyph
            high={range.max}
            low={range.min}
            note={range.note}
            className="rise-in"
          />
          <LocationControl />
        </div>
        <div className="rise-in shrink-0">
          <HeroTemp />
        </div>
      </div>

      {/*
        The empty field: the map's city shows through it, well in view. On a phone it takes half of
        what the screen leaves (the other half is over the hour), which centres the block between them.
      */}
      <div aria-hidden="true" className="min-h-8 flex-1" />

      {/* Keep this place, and what it is: the action the bar had, now in the Testata (ADR-029) */}
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <KeepButton />
        {identity}
      </div>

      {/* On a phone, the foot: the hour and the day on one line, a hairline, the name, the place's facts */}
      <div className="pb-[calc(var(--dock-room)+1rem)] lg:hidden">
        <div className="border-t border-white/30 pt-2">
          <HeroNowPhone
            timezone={timezone}
            renderedAt={renderedAt}
            dataAt={current.time}
          />
        </div>
        <HeroMetaPhone
          region={placeParts(place).region}
          country={placeParts(place).country}
          coords={formatCoords(place.lat, place.lon)}
          className="mt-3"
        />
      </div>

      {/* An hour the address asked for and the forecast does not hold: said, never answered with another hour (the page stays on Adesso) */}
      {unavailable && (
        <p role="status" data-moment-unavailable className="mt-3 text-caption font-medium text-ink lg:mb-3">
          Dato non disponibile per quest&apos;ora{unavailable.asked ? `: ${unavailable.asked}` : ""}. La pagina mostra Adesso.
        </p>
      )}

      {/* On a computer, the foot: one line, the place, the day and the hour (a phone has its own just above) */}
      <div className="lg:pb-1">
        <HeroMeta
          region={placeParts(place).region}
          country={placeParts(place).country}
          coords={formatCoords(place.lat, place.lon)}
          timezone={timezone}
          renderedAt={renderedAt}
          dataAt={current.time}
        />
      </div>

      <p className="sr-only">
        {TIME_LABELS.now} {formatTemp(current.temp)}, {label.toLowerCase()}, percepita{" "}
        {formatTemp(current.feelsLike)}. Massima {formatTemp(range.max)}, minima{" "}
        {formatTemp(range.min)}
        {range.note ? ` (${range.note})` : " oggi"}.
        {sinceYesterday && ` ${sinceYesterday} a quest’ora.`}
      </p>
      <NarrativeText outlook={outlook} />
    </section>
  );
}
