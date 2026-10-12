import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../../test/fixtures/archive-milano-2003-08.json";
import berlin from "../../../../test/fixtures/archive-berlin-1989-11.json";
import washington from "../../../../test/fixtures/archive-washington-1963-08.json";
import mumbai from "../../../../test/fixtures/archive-mumbai-2003-08.json";
import { fingerprintOf } from "@/lib/weather/fingerprint";
import { buildTimeline } from "@/lib/weather/frames";
import { frameLook } from "@/lib/weather/look";
import { MIN_AGE_DAYS, archiveModel, openMeteoArchiveProvider, reconstructionConfidence } from "./openmeteo-archive";
import { WeatherProviderError } from "./openweather";
import type { Place } from "@/types/weather";

/*
 * WTH-168. The fixture is a real answer of Open-Meteo's historical API (ERA5) for Milan, 10 to 14 August 2003,
 * recorded on 2026-10-05 with the parameters the adapter sends. The hour asked for is 13:00 local on the 11th of
 * the heatwave: 36.6 C, 32% humidity, a clear sky. Visibility and UV came back empty, as they do for every model.
 */

const HOUR = Date.parse("2003-08-11T11:00:00Z") / 1000;
const NOW = Date.parse("2026-10-05T10:00:00Z") / 1000;
const milan: Place = { name: "Milano", region: "Lombardia", country: "IT", lat: 45.46, lon: 9.19 };

let calls: { url: string; init?: RequestInit }[] = [];
const answer = (body: unknown = fixture) =>
  vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return { ok: true, status: 200, json: async () => body } as Response;
  });

beforeEach(() => {
  calls = [];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW * 1000);
  vi.stubGlobal("fetch", answer());
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the model of a record, by its date", () => {
  it("is ECMWF's IFS at 9 km from 2017 and ERA5 at 25 km before, and never ERA5-Land alone (it has no cloud, rain or wind)", () => {
    const at = (iso: string) => Date.parse(iso) / 1000;
    expect(archiveModel(at("2017-01-01T00:00:00Z"))).toEqual({ model: "ecmwf_ifs", resolutionKm: 9, kind: "forecast-archive" });
    expect(archiveModel(at("2026-01-01T00:00:00Z")).model).toBe("ecmwf_ifs");
    expect(archiveModel(at("2016-12-31T23:59:59Z"))).toEqual({ model: "era5", resolutionKm: 25, kind: "reanalysis" });
    expect(archiveModel(at("1940-01-01T00:00:00Z")).model).toBe("era5");
  });

  it("is trusted by its age: high from 2017, medium from 1979, low before", () => {
    const at = (iso: string) => Date.parse(iso) / 1000;
    expect(reconstructionConfidence(at("2024-06-01T12:00:00Z"))).toBe("high");
    expect(reconstructionConfidence(at("2017-01-01T00:00:00Z"))).toBe("high");
    expect(reconstructionConfidence(at("2016-12-31T23:00:00Z"))).toBe("medium");
    expect(reconstructionConfidence(at("1979-01-01T00:00:00Z"))).toBe("medium");
    expect(reconstructionConfidence(at("1978-12-31T23:00:00Z"))).toBe("low");
    expect(reconstructionConfidence(at("1945-05-08T12:00:00Z"))).toBe("low");
  });
});

describe("asking the archive", () => {
  it("sends the coordinates rounded, the dates round the hour, the model by date and the quantities, in unix time", async () => {
    await openMeteoArchiveProvider.getAt(45.4642, 9.1895, HOUR, milan);
    expect(calls).toHaveLength(1);
    const url = new URL(calls[0].url);
    expect(url.origin + url.pathname).toBe("https://archive-api.open-meteo.com/v1/archive");
    const q = url.searchParams;
    expect(q.get("latitude")).toBe("45.46");
    expect(q.get("longitude")).toBe("9.19");
    expect(q.get("start_date")).toBe("2003-08-10");
    expect(q.get("end_date")).toBe("2003-08-14");
    expect(q.get("models")).toBe("era5");
    expect(q.get("timezone")).toBe("auto");
    expect(q.get("timeformat")).toBe("unixtime");
    for (const v of ["temperature_2m", "relative_humidity_2m", "dew_point_2m", "precipitation", "cloud_cover", "weather_code", "visibility", "uv_index"])
      expect(q.get("hourly")!.split(",")).toContain(v);
    for (const v of ["sunrise", "sunset", "temperature_2m_max", "temperature_2m_min"]) expect(q.get("daily")!.split(",")).toContain(v);
  });

  it("keeps a date that has settled for a year, and a recent one for a day", async () => {
    await openMeteoArchiveProvider.getAt(45.46, 9.19, HOUR, milan);
    expect((calls[0].init as { next?: { revalidate: number } }).next?.revalidate).toBe(365 * 86400);
    calls = [];
    const recent = NOW - 30 * 86400;
    vi.stubGlobal("fetch", answer({ ...fixture, hourly: { ...fixture.hourly, time: fixture.hourly.time.map((t) => t + (Math.round(recent / 3600) * 3600 - HOUR)) } }));
    await openMeteoArchiveProvider.getAt(45.46, 9.19, recent, milan);
    expect((calls[0].init as { next?: { revalidate: number } }).next?.revalidate).toBe(86400);
  });

  it("refuses a moment before 1940, one that is no number, and one too recent to have settled: nothing is asked", async () => {
    const asks = (at: number) => openMeteoArchiveProvider.getAt(45.46, 9.19, at, milan);
    await expect(asks(Date.parse("1939-12-31T12:00:00Z") / 1000)).rejects.toThrow(/1940/);
    await expect(asks(Number.NaN)).rejects.toBeInstanceOf(WeatherProviderError);
    await expect(asks(NOW)).rejects.toThrow(new RegExp(`${MIN_AGE_DAYS} days`));
    await expect(asks(NOW - (MIN_AGE_DAYS - 1) * 86400)).rejects.toThrow(WeatherProviderError);
    expect(calls).toHaveLength(0);
    // Old enough: it passes the age and is asked (the stand-in archive is of 2003, so it has no such hour, and says so)
    await expect(asks(NOW - (MIN_AGE_DAYS + 1) * 86400 - 3600)).rejects.toThrow(/no reconstruction for that hour/);
    expect(calls).toHaveLength(1);
  });

  it("takes the moment to the nearest hour", async () => {
    const early = await openMeteoArchiveProvider.getAt(45.46, 9.19, HOUR + 20 * 60, milan);
    expect(early.current.time).toBe(HOUR);
    const late = await openMeteoArchiveProvider.getAt(45.46, 9.19, HOUR + 40 * 60, milan);
    expect(late.current.time).toBe(HOUR + 3600);
  });

  it("says when the archive has nothing for the hour: no data, or a hole where the hour should be", async () => {
    vi.stubGlobal("fetch", answer({ ...fixture, hourly: { ...fixture.hourly, time: [] } }));
    await expect(openMeteoArchiveProvider.getAt(45.46, 9.19, HOUR, milan)).rejects.toThrow(/no historical data/);
    const holed = { ...fixture, hourly: { ...fixture.hourly, temperature_2m: fixture.hourly.temperature_2m.map((v, i) => (fixture.hourly.time[i] === HOUR ? null : v)) } };
    vi.stubGlobal("fetch", answer(holed));
    await expect(openMeteoArchiveProvider.getAt(45.46, 9.19, HOUR, milan)).rejects.toThrow(/no reconstruction for that hour/);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }) as Response));
    await expect(openMeteoArchiveProvider.getAt(45.46, 9.19, HOUR, milan)).rejects.toBeInstanceOf(WeatherProviderError);
  });
});

describe("the weather of the record", () => {
  it("is the hour's reconstruction as the page's own current weather, with what the model has no value for left out, not made zero", async () => {
    const { current } = await openMeteoArchiveProvider.getAt(45.46, 9.19, HOUR, milan);
    expect(current.time).toBe(HOUR);
    expect(current.temp).toBe(36.6);
    expect(current.humidity).toBe(32);
    expect(current.dewPoint).toBe(17.2);
    expect(current.condition).toBe("clear");
    expect(current.cloudCover).toBe(4);
    expect(current.uvIndex).toBeUndefined();
    expect(current.atmosphericSources?.visibility).toBe("unavailable");
    expect(current.atmosphericSources?.humidity).toBe("provider");
  });

  it("runs the hours on for two days from the one asked for, with a temperature in every one, and none before it", async () => {
    const { hourly } = await openMeteoArchiveProvider.getAt(45.46, 9.19, HOUR, milan);
    expect(hourly[0].time).toBe(HOUR);
    expect(hourly.at(-1)!.time).toBe(HOUR + 48 * 3600);
    expect(hourly).toHaveLength(49);
    expect(hourly.every((h, i) => i === 0 || h.time === hourly[i - 1].time + 3600)).toBe(true);
    expect(hourly.every((h) => Number.isFinite(h.temp))).toBe(true);
    expect(hourly.every((h) => h.uvIndex === undefined)).toBe(true);
  });

  it("gives no chance of rain, only that it rained or did not: 0 or 1, from the amount", async () => {
    const wet = {
      ...fixture,
      hourly: { ...fixture.hourly, precipitation: fixture.hourly.precipitation.map((_, i) => (i === 38 ? 2.4 : i === 39 ? 0.05 : 0)) },
    };
    vi.stubGlobal("fetch", answer(wet));
    const { hourly, daily } = await openMeteoArchiveProvider.getAt(45.46, 9.19, HOUR, milan);
    const by = (t: number) => hourly.find((h) => h.time === t)!;
    expect(by(HOUR + 3600).precipProbability).toBe(1);
    expect(by(HOUR + 7200).precipProbability).toBe(0);
    expect(by(HOUR + 3600).precipitation).toBe(2.4);
    // The day of the rain says it rained; the days before and after do not
    expect(daily.map((d) => d.precipProbability)).toEqual([0, 1, 0, 0, 0]);
  });

  it("leaves out an hour the model left empty rather than make it a zero", async () => {
    const holed = { ...fixture, hourly: { ...fixture.hourly, temperature_2m: fixture.hourly.temperature_2m.map((v, i) => (i === 40 ? null : v)) } };
    vi.stubGlobal("fetch", answer(holed));
    const { hourly } = await openMeteoArchiveProvider.getAt(45.46, 9.19, HOUR, milan);
    expect(hourly.find((h) => h.time === fixture.hourly.time[40])).toBeUndefined();
    expect(hourly).toHaveLength(48);
    expect(hourly.every((h) => h.temp > 20)).toBe(true);
  });

  it("holds the days, the day's own range and the sun's times of the day that holds the hour", async () => {
    const data = await openMeteoArchiveProvider.getAt(45.46, 9.19, HOUR, milan);
    expect(data.daily).toHaveLength(5);
    const day = data.daily.find((d) => d.time === fixture.daily.time[1])!;
    expect(day.max).toBe(fixture.daily.temperature_2m_max[1]);
    expect(day.min).toBe(fixture.daily.temperature_2m_min[1]);
    expect(data.sunrise).toBe(fixture.daily.sunrise[1]);
    expect(data.sunset).toBe(fixture.daily.sunset[1]);
    expect(data.sunrise).toBeLessThan(HOUR);
    expect(data.sunset).toBeGreaterThan(HOUR);
    expect(data.timezone).toBe("Europe/Rome");
  });

  it("says what it is: a reanalysis, by which model, how coarse, how far to trust it, and what it is silent on", async () => {
    const { reconstruction } = await openMeteoArchiveProvider.getAt(45.46, 9.19, HOUR + 600, milan);
    expect(reconstruction).toEqual({
      kind: "reanalysis",
      model: "era5",
      resolutionKm: 25,
      confidence: "medium",
      requestedAt: HOUR + 600,
      missing: ["visibility", "uvIndex", "airQuality"],
    });
  });

  it("uses a visibility the model gives, the day one has it, and then says nothing of it missing", async () => {
    const seen = { ...fixture, hourly: { ...fixture.hourly, visibility: fixture.hourly.time.map(() => 24140) } };
    vi.stubGlobal("fetch", answer(seen));
    const data = await openMeteoArchiveProvider.getAt(45.46, 9.19, HOUR, milan);
    expect(data.current.visibility).toBe(24.14);
    expect(data.reconstruction?.missing).toEqual(["uvIndex", "airQuality"]);
  });

  it("names the place the caller knows, or gives its coordinates; it has no live data of any kind", async () => {
    expect((await openMeteoArchiveProvider.getAt(45.46, 9.19, HOUR, milan)).place).toEqual(milan);
    const bare = await openMeteoArchiveProvider.getAt(45.4642, 9.1895, HOUR);
    expect(bare.place).toMatchObject({ name: "45.46, 9.19", country: "" });
    expect(bare.minutely).toBeNull();
    expect(bare.quarterHourly).toBeNull();
    expect(bare.airQuality).toBeNull();
    expect(bare.alerts).toEqual([]);
  });
});

describe("a record through the engine", () => {
  it("runs through the timeline, the look and the fingerprint: a hot, clear, dry noon with its provenance", async () => {
    const data = await openMeteoArchiveProvider.getAt(45.46, 9.19, HOUR, milan);
    const { frames, days } = buildTimeline(data);
    expect(frames[0].time).toBe(HOUR);
    expect(frames).toHaveLength(49);
    expect(days.length).toBeGreaterThanOrEqual(2);
    const look = frameLook(frames[0]);
    expect(look.atmosphere.warmth).toBeGreaterThan(0.6);
    expect(look.atmosphere.cloudiness).toBeLessThan(0.1);
    expect(look.atmosphere.haze).toBeLessThan(0.45);
    expect(look.atmosphereInputStatus.visibility).toBe("missing");
    expect(look.atmosphereInputStatus.uvIndex).toBe("missing");
    const fp = fingerprintOf({ atmosphere: look.atmosphere, inputStatus: look.atmosphereInputStatus }, frames[0].light);
    // The provenance is in the key: visibility and UV are not among what the axes rest on
    expect(fp.basis).not.toContain("v");
    expect(fp.basis).not.toContain("u");
    expect(fp.basis).toContain("t");
    expect(fp.basis).toContain("h");
    expect(fp.warmth).toBeGreaterThan(60);
    expect(fp.cloud).toBeLessThan(10);
  });

  it("makes the same fingerprint every time: the DNA of the 11 August 2003 noon in Milan", async () => {
    const key = async () => {
      const data = await openMeteoArchiveProvider.getAt(45.46, 9.19, HOUR, milan);
      const f = buildTimeline(data).frames[0];
      const look = frameLook(f);
      return fingerprintOf({ atmosphere: look.atmosphere, inputStatus: look.atmosphereInputStatus }, f.light);
    };
    const [a, b] = [await key(), await key()];
    expect(a).toEqual(b);
    expect(a.severity).toBe(0);
    expect(a.wet).toBe(0);
    expect(a.snow).toBe(0);
  });
});

describe("what the model leaves empty is said, not made a zero (WTH-168 review)", () => {
  const without = (key: keyof typeof fixture.hourly, from = 0) => ({
    ...fixture,
    hourly: { ...fixture.hourly, [key]: (fixture.hourly[key] as (number | null)[]).map((v, i) => (i >= from ? null : v)) },
  });

  it("lists every quantity with a hole in the hours kept, by the page's names: a whole series of cloud, or one hour of wind", async () => {
    vi.stubGlobal("fetch", answer(without("cloud_cover")));
    expect((await openMeteoArchiveProvider.getAt(45.46, 9.19, HOUR, milan)).reconstruction?.missing).toEqual(["cloudCover", "visibility", "uvIndex", "airQuality"]);
    vi.stubGlobal("fetch", answer(without("wind_speed_10m", 60)));
    expect((await openMeteoArchiveProvider.getAt(45.46, 9.19, HOUR, milan)).reconstruction?.missing).toEqual(["wind", "visibility", "uvIndex", "airQuality"]);
    vi.stubGlobal("fetch", answer(without("pressure_msl")));
    expect((await openMeteoArchiveProvider.getAt(45.46, 9.19, HOUR, milan)).reconstruction?.missing).toContain("pressure");
  });

  it("drops an hour with no weather code, which would read as a clear sky, and refuses a record with none at all", async () => {
    const one = { ...fixture, hourly: { ...fixture.hourly, weather_code: fixture.hourly.weather_code.map((v, i) => (i === 40 ? null : v)) } };
    vi.stubGlobal("fetch", answer(one));
    const { hourly } = await openMeteoArchiveProvider.getAt(45.46, 9.19, HOUR, milan);
    expect(hourly.find((h) => h.time === fixture.hourly.time[40])).toBeUndefined();
    expect(hourly).toHaveLength(48);
    vi.stubGlobal("fetch", answer(without("weather_code")));
    await expect(openMeteoArchiveProvider.getAt(45.46, 9.19, HOUR, milan)).rejects.toThrow(/no reconstruction for that hour/);
  });

  it("calls a date from 2017 a forecast archive and an older one a reanalysis, each with its model and resolution", async () => {
    const delta = Date.parse("2021-02-14T11:00:00Z") / 1000 - HOUR;
    const moved = {
      ...fixture,
      hourly: { ...fixture.hourly, time: fixture.hourly.time.map((t) => t + delta) },
      daily: { ...fixture.daily, time: fixture.daily.time.map((t) => t + delta), sunrise: fixture.daily.sunrise.map((t) => t + delta), sunset: fixture.daily.sunset.map((t) => t + delta) },
    };
    vi.stubGlobal("fetch", answer(moved));
    const recent = await openMeteoArchiveProvider.getAt(45.46, 9.19, HOUR + delta, milan);
    expect(recent.reconstruction).toMatchObject({ kind: "forecast-archive", model: "ecmwf_ifs", resolutionKm: 9, confidence: "high" });
    expect(new URL(calls.at(-1)!.url).searchParams.get("models")).toBe("ecmwf_ifs");
    vi.stubGlobal("fetch", answer());
    const old = await openMeteoArchiveProvider.getAt(45.46, 9.19, HOUR, milan);
    expect(old.reconstruction).toMatchObject({ kind: "reanalysis", model: "era5", resolutionKm: 25 });
  });

  it("looks the place up by its rounded coordinates when the caller gives none, and not when it does", async () => {
    const lookup = vi.fn(async () => null);
    vi.doMock("./openweather", async (original) => ({ ...(await original<typeof import("./openweather")>()), lookupPlace: lookup }));
    vi.resetModules();
    const { openMeteoArchiveProvider: fresh } = await import("./openmeteo-archive");
    await fresh.getAt(45.4642, 9.1895, HOUR);
    expect(lookup).toHaveBeenCalledWith(45.46, 9.19);
    lookup.mockClear();
    await fresh.getAt(45.4642, 9.1895, HOUR, milan);
    expect(lookup).not.toHaveBeenCalled();
    vi.doUnmock("./openweather");
  });
});

describe("the days of a record, cut by the clock the place kept (WTH-168, found on the winter fixture)", () => {
  // Berlin, the night the Wall opened: 23:00 CET on 9 November 1989 (22:00 UTC). The archive cut its days at the
  // offset in force today (+2: `utc_offset_seconds` is 7200 for this date, when Berlin was on +1), an hour out.
  const NIGHT = Date.parse("1989-11-09T22:00:00Z") / 1000;
  const berlinPlace: Place = { name: "Berlino", region: "Berlino", country: "DE", lat: 52.55, lon: 13.4 };

  it("is a fixture that shows the fault: the archive's own offset is that of today, not of 1989", () => {
    expect(berlin.utc_offset_seconds).toBe(7200);
    // Its first hour is 22:00 UTC, the midnight of +2, though Berlin's midnight in November 1989 was at 23:00 UTC
    expect(new Date(berlin.hourly.time[0] * 1000).toISOString()).toBe("1989-11-07T22:00:00.000Z");
  });

  it("cuts the days at the true local midnights, and takes each day's extremes from its own hours", async () => {
    vi.stubGlobal("fetch", answer(berlin));
    const { daily } = await openMeteoArchiveProvider.getAt(52.55, 13.4, NIGHT, berlinPlace);
    const starts = daily.map((d) => new Date(d.time * 1000).toISOString());
    expect(starts.slice(0, 4)).toEqual(["1989-11-07T23:00:00.000Z", "1989-11-08T23:00:00.000Z", "1989-11-09T23:00:00.000Z", "1989-11-10T23:00:00.000Z"]);
    const nov9 = daily[1];
    const hoursOf = berlin.hourly.time.flatMap((t, i) => (t >= nov9.time && t < nov9.time + 86400 ? [berlin.hourly.temperature_2m[i]!] : []));
    expect(hoursOf).toHaveLength(24);
    expect(nov9.min).toBe(Math.min(...hoursOf));
    expect(nov9.max).toBe(Math.max(...hoursOf));
    expect(nov9.partial).toBeUndefined();
  });

  it("marks the day the hours do not cover whole as partial, never as a range that looks whole", async () => {
    vi.stubGlobal("fetch", answer(berlin));
    const { daily } = await openMeteoArchiveProvider.getAt(52.55, 13.4, NIGHT, berlinPlace);
    expect(daily.map((d) => d.partial === true)).toEqual([false, false, false, false, true]);
  });

  it("gives the hour itself as it was: a cold, nearly clear, calm night, with the sun down", async () => {
    vi.stubGlobal("fetch", answer(berlin));
    const data = await openMeteoArchiveProvider.getAt(52.55, 13.4, NIGHT, berlinPlace);
    expect(data.current.time).toBe(NIGHT);
    expect(data.current.temp).toBe(4.1);
    expect(data.current.humidity).toBe(88);
    expect(data.current.condition).toBe("clear");
    expect(data.reconstruction).toMatchObject({ kind: "reanalysis", model: "era5", confidence: "medium" });
    expect(data.sunset).toBeLessThan(NIGHT);
    expect(data.timezone).toBe("Europe/Berlin");
  });
});

describe("day and night from the sun, not from the archive's is_day (WTH-168, found on the Washington fixture)", () => {
  // Washington, 15:00 EDT on 28 August 1963, the March on Washington: 19:00 UTC. ERA5 gives is_day = 0 for every one of
  // the 120 hours it returns for these days; its sunrise (10:32 UTC) and sunset (23:45 UTC) are right.
  const AFTERNOON = Date.parse("1963-08-28T19:00:00Z") / 1000;
  const place: Place = { name: "Washington", region: "District of Columbia", country: "US", lat: 38.89, lon: -77.05 };

  it("is a fixture that shows the fault: not one hour of day in 120, and a sunrise and a sunset in the morning and the evening", () => {
    expect(washington.hourly.is_day.filter((v) => v === 1)).toHaveLength(0);
    expect(new Date(washington.daily.sunrise[1] * 1000).toISOString().slice(11, 16)).toBe("10:32");
    expect(new Date(washington.daily.sunset[1] * 1000).toISOString().slice(11, 16)).toBe("23:45");
  });

  it("calls the afternoon day and the small hours night, whatever the archive says", async () => {
    vi.stubGlobal("fetch", answer(washington));
    const { hourly, current } = await openMeteoArchiveProvider.getAt(38.89, -77.05, AFTERNOON, place);
    expect(current.time).toBe(AFTERNOON);
    const at = (iso: string) => hourly.find((h) => h.time === Date.parse(iso) / 1000)!;
    expect(at("1963-08-28T19:00:00Z").isNight).toBe(false);
    expect(at("1963-08-28T12:00:00Z")).toBeUndefined();
    expect(at("1963-08-29T05:00:00Z").isNight).toBe(true);
    expect(at("1963-08-29T12:00:00Z").isNight).toBe(false);
    // Day lasts from sunrise to sunset: 13 hours and a bit, by the sun's own times
    const dayHours = hourly.filter((h) => h.time < AFTERNOON + 24 * 3600 && !h.isNight).length;
    expect(dayHours).toBeGreaterThanOrEqual(12);
    expect(dayHours).toBeLessThanOrEqual(14);
  });

  it("keeps the engine's solar phase right for the record: a bright afternoon is day, not night", async () => {
    vi.stubGlobal("fetch", answer(washington));
    const data = await openMeteoArchiveProvider.getAt(38.89, -77.05, AFTERNOON, place);
    const f = buildTimeline(data).frames[0];
    expect(f.phase).toBe("day");
    expect(f.light).toBeGreaterThan(0.3);
    expect(f.light).toBeLessThan(0.9);
    expect(frameLook(f).atmosphere.daylight).toBeGreaterThan(0.8);
  });
});

describe("the places the archive cuts oddly (WTH-168, second review)", () => {
  const afternoon = Date.parse("1963-08-28T19:00:00Z") / 1000;
  const dc: Place = { name: "Washington", region: "District of Columbia", country: "US", lat: 38.89, lon: -77.05 };

  it("finds the hour in a zone with an odd offset: Mumbai's hours fall on the half hour in UTC, and the record takes the nearest", async () => {
    expect(new Set(mumbai.hourly.time.map((t) => (t / 60) % 60))).toEqual(new Set([30]));
    vi.stubGlobal("fetch", answer(mumbai));
    const mum: Place = { name: "Mumbai", region: "Maharashtra", country: "IN", lat: 19.07, lon: 72.88 };
    const at = Date.parse("2003-08-11T12:10:00Z") / 1000;
    const data = await openMeteoArchiveProvider.getAt(19.07, 72.88, at, mum);
    expect(new Date(data.current.time * 1000).toISOString()).toBe("2003-08-11T12:30:00.000Z");
    expect(data.hourly[0].time).toBe(data.current.time);
    expect(data.hourly.every((h, i) => i === 0 || h.time === data.hourly[i - 1].time + 3600)).toBe(true);
    expect(data.timezone).toBe("Asia/Kolkata");
    // Half an hour either side is still that hour; more is no hour of the archive's
    const far = Date.parse("2003-08-11T12:00:00Z") / 1000;
    await expect(openMeteoArchiveProvider.getAt(19.07, 72.88, far, mum)).resolves.toBeDefined();
  });

  it("keeps the archive's own days, all partial and in order, when its offset is a day away from the one then (Samoa before 2011)", async () => {
    // The Washington answer told it is a zone whose offset in 1963 was 12 hours or more from the archive's: the true cut
    // does not line up with the archive's days, so it is not trusted
    vi.stubGlobal("fetch", answer({ ...washington, timezone: "Pacific/Auckland" }));
    const { daily } = await openMeteoArchiveProvider.getAt(38.89, -77.05, afternoon, dc);
    expect(daily).toHaveLength(5);
    expect(daily.every((d) => d.partial === true)).toBe(true);
    expect(daily.every((d, i) => i === 0 || d.time > daily[i - 1].time)).toBe(true);
    expect(daily.map((d) => d.time)).toEqual(washington.daily.time);
  });

  it("trusts the cut when it lines up: Berlin, an hour out, keeps the true days", async () => {
    vi.stubGlobal("fetch", answer(berlin));
    const { daily } = await openMeteoArchiveProvider.getAt(52.55, 13.4, Date.parse("1989-11-09T22:00:00Z") / 1000);
    expect(daily.map((d) => d.time)).not.toEqual(berlin.daily.time);
    expect(daily.filter((d) => d.partial).length).toBe(1);
  });

  it("decides day and night by the sun's height where the sunrise and sunset are missing or out of order, never by the archive's flag", async () => {
    const broken = (sunrise: (number | null)[], sunset: (number | null)[]) => ({ ...washington, daily: { ...washington.daily, sunrise, sunset } });
    const nulls = washington.daily.time.map(() => null);
    const reversed = broken(washington.daily.sunset, washington.daily.sunrise);
    for (const body of [broken(nulls, nulls), reversed]) {
      vi.stubGlobal("fetch", answer(body));
      const { hourly } = await openMeteoArchiveProvider.getAt(38.89, -77.05, afternoon, dc);
      const at = (iso: string) => hourly.find((h) => h.time === Date.parse(iso) / 1000)!;
      expect(at("1963-08-28T19:00:00Z").isNight).toBe(false);
      expect(at("1963-08-29T05:00:00Z").isNight).toBe(true);
      expect(at("1963-08-29T15:00:00Z").isNight).toBe(false);
    }
  });
});
