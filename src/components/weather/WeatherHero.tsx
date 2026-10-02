import {
  conditionLabel,
  formatCoords,
  formatTemp,
  placeParts,
} from "@/lib/weather/formatters";
import type { TempRange } from "@/lib/weather/today";
import { yesterdayWords } from "@/lib/weather/yesterday";
import type { CurrentWeather, Place } from "@/lib/weather/types";
import { LocationControl } from "../location/LocationControl";
import {
  HeroActions,
  HeroMeta,
  HeroMetaPhone,
  HeroNowPhone,
} from "../time/HeroMeta";
import { HeroReading } from "../time/HeroReading";
import { HeroGlyph, HeroTemp } from "../time/HeroTemp";

/**
 * The reading as a Swiss typographic poster, on a six-column grid, flush left
 * and ragged right. From the top: the two actions; the head (place, day, hour,
 * with the coordinates and the day of the year as small print); then one
 * composition: the place's name heavy, the temperature
 * bold against it on one baseline, and over the name the day's low and high
 * and the sky as a glyph in one row; an empty field where the map shows the city; the
 * outlook, large, at the foot.
 */
export function WeatherHero({
  place,
  timezone,
  current,
  range,
  renderedAt,
  outlook,
  yesterday,
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
  // line (a heavy grotesk runs about 0.58em a letter).
  const titleSize = Math.min(
    15,
    96 / (0.58 * longest + 0.58 * 1.9 * widestTemp + 0.1),
    place.name.length > 20 ? 8 : 15,
  );

  return (
    // The map behind the page centres the city on the middle of this poster (see MapBackdropGL).
    // On a phone it fills what the first screen leaves under the search (12.5rem: the name, the field,
    // the saved places and the gaps), so the reading is that screen: the hour, the name and the
    // temperature centred on it, over the city, and the outlook at its foot.
    <section
      data-map-anchor="poster"
      // On a phone the finger here moves the map (see MapGestures)
      data-map-gestures
      aria-label="Meteo attuale"
      className="on-sky flex min-h-[calc(100svh-12.5rem)] flex-col lg:min-h-full"
    >
      <HeroActions />
      <HeroMeta
        region={placeParts(place).region}
        country={placeParts(place).country}
        coords={formatCoords(place.lat, place.lon)}
        timezone={timezone}
        renderedAt={renderedAt}
        dataAt={current.time}
      />

      {/*
        The title: the name on four columns, the temperature on the last two (under the
        clock), in one size, set here once for both, closing on the name's last baseline.
        It is as large as the name's longest word allows on its four columns (a heavy
        grotesk runs about 0.56em a letter), and steps down for a long name.
      */}
      {/* On a phone the hour and the day stand over the name, and the block sits at the middle of the screen */}
      <div aria-hidden="true" className="min-h-4 flex-1 lg:hidden" />
      <HeroNowPhone
        timezone={timezone}
        renderedAt={renderedAt}
        dataAt={current.time}
        className="mb-4 lg:hidden"
      />

      {/*
        The composition: over the name, close to it, the day's low and high with the sky's glyph; the
        temperature at the right edge, 1.9 times its size and ending on the baseline of the name's first line (see
        HeroTemp), so it is the largest thing on the poster. The name sets the size, the temperature
        follows it, and both step down together for a long name.
      */}
      <div
        className="mt-3 flex items-start justify-between gap-x-[0.08em] lg:mt-5"
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

      <HeroMetaPhone
        region={placeParts(place).region}
        country={placeParts(place).country}
        coords={formatCoords(place.lat, place.lon)}
        className="mt-4 lg:hidden"
      />

      {/*
        The empty field: the map's city shows through it, well in view. On a phone it takes half of
        what the screen leaves (the other half is over the hour), which centres the block between them.
      */}
      <div aria-hidden="true" className="min-h-10 flex-1 lg:min-h-8" />

      <p className="sr-only">
        Adesso {formatTemp(current.temp)}, {label.toLowerCase()}, percepita{" "}
        {formatTemp(current.feelsLike)}. Massima {formatTemp(range.max)}, minima{" "}
        {formatTemp(range.min)}
        {range.note ? ` (${range.note})` : " oggi"}.
        {sinceYesterday && ` ${sinceYesterday} a quest’ora.`}
      </p>
      <HeroReading outlook={outlook} />
    </section>
  );
}
