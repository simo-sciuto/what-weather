import { conditionLabel, formatCoords, formatTemp, placeSubtitle } from "@/lib/weather/formatters";
import type { TempRange } from "@/lib/weather/today";
import type { CurrentWeather, Place } from "@/lib/weather/types";
import { LocationControl } from "../location/LocationControl";
import { HeroMeta, HeroMetaPhone, HeroNowPhone } from "../time/HeroMeta";
import { HeroReading } from "../time/HeroReading";
import { HeroSky, HeroTemp } from "../time/HeroTemp";

/**
 * The reading as a Swiss typographic poster, on a six-column grid, flush left
 * and ragged right. Everything hangs from the same three axes (columns 1, 3
 * and 5), and there are three sizes of text besides the title: small print,
 * text and the outlook. From the top: the head (place,
 * day, hour, with the coordinates and the day of the year as small print);
 * the title, the place's name heavy and the temperature light, closing on one
 * baseline; under the temperature, a short stack of the sky, the range and the
 * feels-like; an empty field where the map shows the city; the outlook, large,
 * at the foot.
 */
export function WeatherHero({
  place,
  timezone,
  current,
  range,
  renderedAt,
  outlook,
}: {
  place: Place;
  timezone: string;
  current: CurrentWeather;
  range: TempRange;
  /** Server time of this render; the clock starts here, then ticks */
  renderedAt: number;
  outlook: string;
}) {
  const label = conditionLabel(current);
  const longest = Math.max(...place.name.split(/\s+/).map((word) => word.length));
  // The temperature shares the size on two columns (about 30 of the 100 units): its longest
  // reading of the day, sign and degree included, at about 0.6em a figure, must fit there too.
  const widestTemp = Math.max(...[current.temp, range.min, range.max].map((t) => formatTemp(t).length));
  const titleSize = Math.min(15, 60 / (0.56 * longest), place.name.length > 20 ? 8 : 15, 30 / (0.6 * widestTemp));

  return (
    // The map behind the page centres the city on the middle of this poster (see MapBackdropGL).
    <section data-map-anchor="poster" aria-label="Meteo attuale" className="on-sky flex min-h-[80svh] flex-col lg:min-h-full">
      <HeroMeta
        region={placeSubtitle(place)}
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
      {/* On a phone the hour and the day stand over the name */}
      <HeroNowPhone timezone={timezone} renderedAt={renderedAt} dataAt={current.time} className="mb-4 lg:hidden" />

      <div
        className="grid grid-cols-6 gap-x-4 items-baseline-last lg:mt-1"
        style={{ fontSize: `max(2rem, min(${titleSize}cqw, ${titleSize * 0.85}cqh))` }}
      >
        <div className="col-span-4 min-w-0">
          <LocationControl />
        </div>
        <div className="rise-in col-span-2 min-w-0">
          <HeroTemp />
        </div>
      </div>

      {/*
        Under the title, level with each other: on a phone, the place's facts under the name
        (on a computer they are the head); the sky, the range and the feels-like under the
        temperature, close to it.
      */}
      <div className="mt-1 grid grid-cols-6 items-start gap-x-4 ">
        <HeroMetaPhone
          region={placeSubtitle(place)}
          coords={formatCoords(place.lat, place.lon)}
          className="col-span-4 min-w-0 lg:hidden"
        />
        <HeroSky high={range.max} low={range.min} note={range.note} className="rise-in col-span-2 col-start-5 min-w-0" />
      </div>

      {/* The empty field: the map's city shows through it, well in view. It takes what the screen leaves, on a phone too */}
      <div aria-hidden="true" className="min-h-56 flex-1 lg:min-h-8" />

      <p className="sr-only">
        Adesso {formatTemp(current.temp)}, {label.toLowerCase()}, percepita {formatTemp(current.feelsLike)}. Massima{" "}
        {formatTemp(range.max)}, minima {formatTemp(range.min)}
        {range.note ? ` (${range.note})` : " oggi"}.
      </p>
      <HeroReading outlook={outlook} />
    </section>
  );
}
