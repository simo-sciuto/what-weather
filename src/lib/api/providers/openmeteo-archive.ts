import "server-only";
import { localDayBounds } from "@/lib/weather/formatters";
import { sunPosition } from "@/lib/weather/sun-position";
import { get, toCurrent, toDaily, toHourly, type OMForecast } from "./openmeteo";
import { WeatherProviderError, lookupPlace } from "./openweather";
import { roundCoord } from "@/lib/weather/coordinates";
import type { HistoricalProvider } from "./provider";
import type { Place, Reconstruction, ReconstructionConfidence, WeatherData } from "@/types/weather";

/**
 * The weather of a past moment from Open-Meteo's historical API (https://open-meteo.com/en/docs/historical-weather-api):
 * ERA5, a reanalysis (ECMWF's model re-run over the past with the observations of the time folded in), before
 * 2017; from 2017 ECMWF's IFS as Open-Meteo assembles it from the operational model's own runs at 0, 6, 12 and
 * 18 UTC, a forecast archive, not a reanalysis. Either way it is a model's account of a grid cell, not a
 * measurement of the place, and the record says so (`WeatherData.reconstruction`). Free for non-commercial use
 * only: selling records needs a paid plan, see docs/RECORDS_LICENCES.md. Credit: Open-Meteo; for ERA5 also
 * "Generated using Copernicus Climate Change Service information"; for the IFS the page names no credit of
 * ECMWF's, to confirm with Open-Meteo before any sale.
 */

const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";

/** ERA5 begins in 1940 */
const FIRST_DAY = Date.UTC(1940, 0, 1) / 1000;
/** The data of the last days is preliminary or absent (ERA5 has a delay of five days) and the timeline runs two days on from the hour: a record is of a moment at least this old */
export const MIN_AGE_DAYS = 10;
/** The hours the timeline runs on from the one asked for (two days) */
const SPAN_HOURS = 48;
/** ERA5's last months are replaced by a final version, slightly different: cached a day until they are older than this, a year after */
const SETTLED_DAYS = 100;
const UNSETTLED_REVALIDATE_SECONDS = 24 * 60 * 60;
const SETTLED_REVALIDATE_SECONDS = 365 * 24 * 60 * 60;

const HOURLY = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "dew_point_2m",
  "precipitation",
  "weather_code",
  "cloud_cover",
  "pressure_msl",
  "wind_speed_10m",
  "wind_gusts_10m",
  "wind_direction_10m",
  "is_day",
  // Not in the reanalyses today (they come back empty): asked for, so they are used the day a model has them
  "visibility",
  "uv_index",
] as const;
/** What each quantity is called in `Reconstruction.missing`: the page's own names */
const QUANTITY: Record<(typeof HOURLY)[number], string> = {
  temperature_2m: "temp",
  apparent_temperature: "feelsLike",
  relative_humidity_2m: "humidity",
  dew_point_2m: "dewPoint",
  precipitation: "precipitation",
  weather_code: "condition",
  cloud_cover: "cloudCover",
  pressure_msl: "pressure",
  wind_speed_10m: "wind",
  wind_gusts_10m: "windGust",
  wind_direction_10m: "windDeg",
  is_day: "isDay",
  visibility: "visibility",
  uv_index: "uvIndex",
};
const DAILY = ["weather_code", "temperature_2m_max", "temperature_2m_min", "sunrise", "sunset", "wind_gusts_10m_max", "uv_index_max"] as const;

type Series<K extends string> = { time: number[] } & Record<K, (number | null)[]>;
type OMArchive = {
  timezone: string;
  hourly: Series<(typeof HOURLY)[number]>;
  daily: Series<(typeof DAILY)[number]>;
}

/**
 * The model, chosen by date and named, not left to the provider's own pick, so the record can say what it is made
 * of: ECMWF's IFS at 9 km from 2017 (a forecast archive), ERA5 at 25 km before it, from 1940 (a reanalysis).
 * ERA5-Land alone is not used: it has no cloud, no precipitation, no wind and no weather code.
 */
export function archiveModel(at: number): { model: "ecmwf_ifs" | "era5"; resolutionKm: number; kind: Reconstruction["kind"] } {
  return at >= Date.UTC(2017, 0, 1) / 1000
    ? { model: "ecmwf_ifs", resolutionKm: 9, kind: "forecast-archive" }
    : { model: "era5", resolutionKm: 25, kind: "reanalysis" };
}

/**
 * How far to trust the reconstruction, by the date (an initial rule, from ECMWF's own notes on ERA5): high from
 * 2017 (the IFS, 9 km, with today's observing system); medium from 1979 (ERA5, with satellite data); low before
 * (the ERA5 back extension: no satellite data before 1970, sparse observations, a skill that declines before
 * 1957, and no upper-air data before the mid-1940s). Surface temperature holds up well even then, and the older
 * the date the more a record's numbers are a model's idea of the day.
 */
export function reconstructionConfidence(at: number): ReconstructionConfidence {
  const year = new Date(at * 1000).getUTCFullYear();
  return year >= 2017 ? "high" : year >= 1979 ? "medium" : "low";
}

const isoDay = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
const nulls = (n: number) => Array.from({ length: n }, () => null);

/** Whole hour the record is of, or an error saying why there is none: too old for the model, or too recent for it to have settled */
function recordHour(at: number, now: number): number {
  if (!Number.isFinite(at)) throw new WeatherProviderError("A record needs a moment, as Unix seconds");
  const hour = Math.round(at / 3600) * 3600;
  if (hour < FIRST_DAY) throw new WeatherProviderError("The historical weather begins in 1940");
  if (hour > now - MIN_AGE_DAYS * 86400) {
    throw new WeatherProviderError(`The historical weather is of moments at least ${MIN_AGE_DAYS} days ago: the forecast has the recent ones`);
  }
  return hour;
}

export const openMeteoArchiveProvider: HistoricalProvider = {
  name: "open-meteo-archive",

  async getAt(rawLat, rawLon, at, known?: Place): Promise<WeatherData> {
    const now = Date.now() / 1000;
    const hour = recordHour(at, now);
    const lat = roundCoord(rawLat);
    const lon = roundCoord(rawLon);
    const { model, resolutionKm, kind } = archiveModel(hour);

    const raw = await get<OMArchive>(
      ARCHIVE,
      {
        latitude: lat,
        longitude: lon,
        // A day either side of the hour in UTC covers its local day, and three on cover the two days of the timeline
        start_date: isoDay(hour - 86400),
        end_date: isoDay(hour + (SPAN_HOURS / 24 + 1) * 86400),
        timezone: "auto",
        timeformat: "unixtime",
        models: model,
        hourly: HOURLY.join(","),
        daily: DAILY.join(","),
      },
      // The past does not change, once it has settled
      now - hour > SETTLED_DAYS * 86400 ? SETTLED_REVALIDATE_SECONDS : UNSETTLED_REVALIDATE_SECONDS,
    );
    if (!raw.hourly?.time?.length) throw new WeatherProviderError("Open-Meteo returned no historical data");

    // The hours with a temperature and a sky: the series is whole for a settled date, and a hole in either is left out
    // (the timeline interpolates over it), not made a zero, nor a clear sky
    const keep = raw.hourly.time.map((_, i) => raw.hourly.temperature_2m[i] != null && raw.hourly.weather_code?.[i] != null);
    // The reconstruction's own instant nearest the hour: a zone with an odd offset (India, +5:30; Nepal, +5:45) has
    // its hours on the half hour or the quarter in UTC, which an exact whole hour would never find
    const nearest = raw.hourly.time.reduce((best, t, i) => (keep[i] && (best < 0 || Math.abs(t - at) < Math.abs(raw.hourly.time[best] - at)) ? i : best), -1);
    if (nearest < 0 || Math.abs(raw.hourly.time[nearest] - at) > 1800) throw new WeatherProviderError("Open-Meteo has no reconstruction for that hour");
    const instant = raw.hourly.time[nearest];

    const pick = <T,>(series: T[]) => series.filter((_, i) => keep[i]);
    const hourlyRaw = {
      time: pick(raw.hourly.time),
      ...Object.fromEntries(HOURLY.map((k) => [k, pick(raw.hourly[k] ?? nulls(raw.hourly.time.length))])),
      // A reanalysis has no forecast to be unsure of: no chance of rain, set from the amount below
      precipitation_probability: nulls(pick(raw.hourly.time).length),
    } as OMForecast["hourly"];
    const at2 = hourlyRaw.time.indexOf(instant);

    // The archive cuts its days at a fixed offset from UTC, the one in force when it is asked (`utc_offset_seconds`
    // is that of today whatever the date: +2 in Berlin for November 1989, when it was +1), so its "days" and the
    // minima, maxima and gusts it gives for them are off by an hour or more. The hours themselves are exact
    // instants. The days are cut here, by the clock the place kept on that date, and their extremes taken from
    // the hours; a day the hours do not cover whole is `partial`, not a range that looks whole.
    const cut = raw.daily.time.map((t) => {
      const [from, to] = localDayBounds(t + 12 * 3600, raw.timezone);
      const inDay = hourlyRaw.time.flatMap((time, i) => (time >= from && time < to ? [i] : []));
      const values = (series: (number | null)[]) => inDay.map((i) => series[i]).filter((v): v is number => v != null);
      const [temps, gusts] = [values(hourlyRaw.temperature_2m), values(hourlyRaw.wind_gusts_10m)];
      return { from, to, complete: inDay.length === Math.round((to - from) / 3600), min: temps.length ? Math.min(...temps) : null, max: temps.length ? Math.max(...temps) : null, gust: gusts.length ? Math.max(...gusts) : null };
    });
    // The cut is trusted only when it lines up with the archive's own days (they differ by an hour or two where
    // the offset of today is not that of the date). A zone whose offset then was a day away from today's (Samoa
    // before 2011, Kwajalein before 1993) puts the +12 h noon in the wrong day and every index out of step: the
    // archive's days are kept as they are, all marked partial, with its own extremes.
    const aligned = cut.every((d, i) => Math.abs(raw.daily.time[i] - d.from) <= 6 * 3600 && (i === 0 || d.from > cut[i - 1].from));
    const days = aligned
      ? cut
      : raw.daily.time.map((t, i) => ({ from: t, to: raw.daily.time[i + 1] ?? t + 86400, complete: false, min: null, max: null, gust: null }));
    // Day and night from the sun's own times, not the archive's `is_day`: ERA5 gave 0 for every hour of 28 August 1963
    // in Washington (the 120 hours recorded for it: not one of day), though its sunrise and sunset are right.
    // Where a day has no sunrise and sunset in order (the polar day and night, a sunset after midnight at high
    // latitudes) the sun's altitude decides, never the archive's flag.
    const isDay = hourlyRaw.time.map((t) => {
      const d = days.findIndex((x) => t >= x.from && t < x.to);
      const [rise, set] = d < 0 ? [null, null] : [raw.daily.sunrise?.[d] ?? null, raw.daily.sunset?.[d] ?? null];
      if (rise != null && set != null && set > rise) return t >= rise && t < set ? 1 : 0;
      return sunPosition(t, lat, lon).altitude > -0.833 ? 1 : 0;
    });
    hourlyRaw.is_day = isDay;

    const current = toCurrent({
      time: instant,
      interval: 3600,
      ...Object.fromEntries(
        [
          "temperature_2m",
          "apparent_temperature",
          "relative_humidity_2m",
          "dew_point_2m",
          "is_day",
          "precipitation",
          "weather_code",
          "cloud_cover",
          "pressure_msl",
          "wind_speed_10m",
          "wind_direction_10m",
          "wind_gusts_10m",
          "visibility",
          "uv_index",
        ].map((k) => [k, (hourlyRaw as unknown as Record<string, (number | null)[]>)[k]?.[at2] ?? null]),
      ),
    } as OMForecast["current"]);

    // It rained, in the reconstruction, or it did not: a chance of 0 or 1, never an invented in-between
    const wet = (mm: number) => (mm >= 0.1 ? 1 : 0);
    const hourly = toHourly(hourlyRaw, instant)
      .filter((h) => h.time <= instant + SPAN_HOURS * 3600)
      .map((h) => ({ ...h, precipProbability: wet(h.precipitation) }));

    const dailyRaw = {
      ...Object.fromEntries(DAILY.map((k) => [k, raw.daily[k] ?? nulls(raw.daily.time.length)])),
      time: days.map((d) => d.from),
      temperature_2m_min: days.map((d, i) => d.min ?? raw.daily.temperature_2m_min[i]),
      temperature_2m_max: days.map((d, i) => d.max ?? raw.daily.temperature_2m_max[i]),
      wind_gusts_10m_max: days.map((d, i) => d.gust ?? raw.daily.wind_gusts_10m_max[i]),
      precipitation_probability_max: nulls(raw.daily.time.length),
    } as OMForecast["daily"];
    const daily = toDaily(dailyRaw, hourlyRaw).map((d, i) => {
      const rained = hourlyRaw.time.some((t, j) => t >= days[i].from && t < days[i].to && wet(Number(hourlyRaw.precipitation[j] ?? 0)));
      return { ...d, precipProbability: rained ? 1 : 0, ...(days[i].complete ? {} : { partial: true }) };
    });
    // The day that holds the hour gives the sun's times
    const day = daily.find((d, i) => instant >= d.time && instant < (daily[i + 1]?.time ?? d.time + 86400)) ?? daily[0];

    const reconstruction: Reconstruction = {
      kind,
      model,
      resolutionKm,
      confidence: reconstructionConfidence(hour),
      requestedAt: at,
      // Every quantity the model gave no value for in some of the hours kept (the page would show it as a zero), by the
      // page's own names, so the record is silent on it; the air is not asked for here
      missing: [...HOURLY.filter((k) => (hourlyRaw as unknown as Record<string, (number | null)[]>)[k].some((v) => v == null)).map((k) => QUANTITY[k]), "airQuality"],
    };

    return {
      place: known ?? (await lookupPlace(lat, lon)) ?? { name: `${lat.toFixed(2)}, ${lon.toFixed(2)}`, country: "", lat, lon },
      timezone: raw.timezone,
      sunrise: day?.sunrise ?? 0,
      sunset: day?.sunset ?? 0,
      current,
      minutely: null,
      quarterHourly: null,
      hourly,
      daily,
      airQuality: null,
      alerts: [],
      reconstruction,
    };
  },
};
