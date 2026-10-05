import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { atmosphericData, estimatedDewPoint, interpolateAtmosphericData } from "./atmospheric-data";
import { buildTimeline, hourlySamples } from "./frames";
import { frameLook } from "./look";
import { createMockProvider } from "@/lib/api/providers/mock";
import { openMeteoProvider } from "@/lib/api/providers/openmeteo";
import { atmospherePalette } from "./palette";
import { toCurrent, toCurrent25, toForecastPoints, toHourly, type OWCurrent, type OW25Current, type OW25ForecastItem } from "@/lib/api/providers/openweather-transformers";

const NOW = Date.parse("2026-10-04T10:00:00Z") / 1000;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW * 1000);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const weather = [{ id: 800, main: "Clear", description: "clear sky", icon: "01d" }];
const oneCall: OWCurrent = {
  dt: NOW, sunrise: NOW - 14400, sunset: NOW + 28800, temp: 20, feels_like: 20,
  pressure: 1015, humidity: 70, dew_point: 14, uvi: 4, clouds: 10,
  visibility: 12500, wind_speed: 2, wind_deg: 0, weather,
};
const freeCurrent: OW25Current = {
  dt: NOW, name: "Test", timezone: 0,
  main: { temp: 20, feels_like: 20, temp_min: 18, temp_max: 22, pressure: 1015, humidity: 70 },
  weather, wind: { speed: 2, deg: 0 }, clouds: { all: 10 }, visibility: 12500,
  sys: { country: "IT", sunrise: NOW - 14400, sunset: NOW + 28800 },
};
const freeHour: OW25ForecastItem = {
  dt: NOW + 10800, main: freeCurrent.main, weather, wind: freeCurrent.wind,
  clouds: freeCurrent.clouds, visibility: 8000, pop: 0, sys: { pod: "d" },
};
const mock = () => createMockProvider("clear", "12:00").getByCoords(45.46, 9.19);

describe("atmospheric provider data", () => {
  it("carries One Call current/hourly measurements in project units", () => {
    for (const point of [toCurrent(oneCall), toHourly([{ ...oneCall, pop: 0 }])[0]]) {
      expect(point.humidity).toBe(70);
      expect(point.visibility).toBe(12.5);
      expect(point.dewPoint).toBe(14);
      expect(point.atmosphericSources).toEqual({ humidity: "provider", visibility: "provider", dewPoint: "provider" });
    }
  });

  it("excludes the legacy 10 km UI default when provider visibility is absent", () => {
    const current = toCurrent({ ...oneCall, visibility: undefined });
    expect(current.visibility).toBe(10);
    expect(current.atmosphericSources?.visibility).toBe("unavailable");
    expect(atmosphericData(current).visibility).toBeUndefined();
    expect(toHourly([{ ...oneCall, visibility: undefined, pop: 0 }])[0].visibility).toBeUndefined();
    expect(toCurrent({ ...oneCall, visibility: 0 }).atmosphericSources?.visibility).toBe("provider");
  });

  it("labels free-tier dew estimates and prefers supplied dew point", () => {
    const current = toCurrent25(freeCurrent);
    const hourly = toForecastPoints([freeHour])[0];
    expect(current.dewPoint).toBeCloseTo(14.36, 1);
    expect(hourly.dewPoint).toBe(current.dewPoint);
    expect(hourly.visibility).toBe(8);
    expect(current.atmosphericSources?.dewPoint).toBe("estimated");
    expect(hourly.atmosphericSources?.dewPoint).toBe("estimated");
    const supplied = toForecastPoints([{ ...freeHour, main: { ...freeHour.main, dew_point: 0 } }])[0];
    expect(supplied.dewPoint).toBe(0);
    expect(supplied.atmosphericSources?.dewPoint).toBe("provider");
    expect(estimatedDewPoint(20, 0)).toBeUndefined();
    expect(estimatedDewPoint(20, 101)).toBeUndefined();
    expect(toForecastPoints([{ ...freeHour, main: { ...freeHour.main, humidity: 0 } }])[0].dewPoint).toBeUndefined();
  });

  it("requests and maps Open-Meteo hourly atmosphere, keeping nulls unavailable", async () => {
    const rows: Record<string, (number | null)[]> = {
      time: [NOW + 3600, NOW + 7200], temperature_2m: [20, 21], apparent_temperature: [20, 21],
      precipitation_probability: [0, 0], precipitation: [0, 0], weather_code: [0, 0], cloud_cover: [10, 20],
      pressure_msl: [1015, 1015], wind_speed_10m: [10, 10], wind_gusts_10m: [12, 12], uv_index: [4, 5], is_day: [1, 1],
      relative_humidity_2m: [0, null], dew_point_2m: [0, null], visibility: [2500, null],
    };
    const fetchMock = vi.fn(async (url: string) => {
      const parsed = new URL(url);
      if (parsed.hostname === "api.open-meteo.com") return Response.json({
        timezone: "UTC",
        current: { time: NOW, interval: 900, temperature_2m: 20, apparent_temperature: 20, weather_code: 0,
          relative_humidity_2m: null, dew_point_2m: null, visibility: null },
        hourly: rows, daily: { time: [] },
      });
      return Response.json(parsed.pathname.includes("reverse") ? [] : {});
    });
    vi.stubGlobal("fetch", fetchMock);
    const data = await openMeteoProvider.getByCoords(45, 9);
    const request = new URL(fetchMock.mock.calls.find(([url]) => url.includes("api.open-meteo.com/v1/forecast"))![0]);
    expect(request.searchParams.get("hourly")?.split(",")).toEqual(expect.arrayContaining(["relative_humidity_2m", "dew_point_2m", "visibility"]));
    expect(data.hourly[0]).toMatchObject({ humidity: 0, dewPoint: 0, visibility: 2.5 });
    expect(data.hourly[1].humidity).toBeUndefined();
    expect(data.hourly[1].visibility).toBeUndefined();
    expect(data.hourly[1].dewPoint).toBeUndefined();
    expect(atmosphericData(data.current).humidity).toBeUndefined();
    const frames = buildTimeline(data).frames;
    expect(frames[0].visibility).toBeUndefined();
    expect(frameLook(frames[1]).atmosphereInputStatus.visibility).toBe("supplied");
    expect(frameLook(frames[2]).atmosphereInputStatus.visibility).toBe("missing");
  });

  it("rejects nonfinite and physically invalid atmospheric readings without losing zero", () => {
    const bad = atmosphericData({ humidity: NaN, visibility: -1, dewPoint: Infinity }, "provider");
    expect(bad.atmosphericSources).toEqual({ humidity: "unavailable", visibility: "unavailable", dewPoint: "unavailable" });
    const zero = atmosphericData({ humidity: 0, visibility: 0, dewPoint: 0 }, "provider");
    expect(zero).toMatchObject({ humidity: 0, visibility: 0, dewPoint: 0 });
  });
});

describe("atmospheric timeline", () => {
  it("propagates mock atmosphere for current and future hours with synthetic origin", async () => {
    const data = await mock();
    const frames = buildTimeline(data).frames;
    expect(frames[0].humidity).toBe(data.current.humidity);
    expect(frames[0].visibility).toBe(data.current.visibility);
    expect(frames[1].dewPoint).toBeCloseTo(data.hourly[0].dewPoint!, 2);
    expect(frames[1].atmosphericSources?.dewPoint).toBe("mock");
    expect(frameLook(frames[1]).atmosphereInputStatus.uvIndex).toBe("supplied");
  });

  it("interpolates three-hour values and preserves exact endpoints and estimated origin", async () => {
    const data = await mock();
    data.current = { ...data.current, time: NOW, ...atmosphericData({ humidity: 40, visibility: 12, dewPoint: 0 }, "provider") };
    data.hourly = [{ ...data.hourly[0], time: NOW + 10800, ...atmosphericData({ humidity: 70, visibility: 3, dewPoint: 9 }, "estimated") }];
    const frames = buildTimeline(data).frames;
    expect(frames.map(f => f.measured)).toEqual([true, false, false, true]);
    expect(frames.map(f => f.humidity)).toEqual([40, 50, 60, 70]);
    expect(frames.map(f => f.visibility)).toEqual([12, 9, 6, 3]);
    expect(frames.map(f => f.dewPoint)).toEqual([0, 3, 6, 9]);
    expect(frames[1].atmosphericSources?.dewPoint).toBe("estimated");
    expect(frames[3].atmosphericSources?.dewPoint).toBe("estimated");
  });

  it("does not carry current atmosphere into a missing forecast or discard a valid endpoint", async () => {
    const full = atmosphericData({ humidity: 50, visibility: 10, dewPoint: 10 }, "provider");
    const absent = atmosphericData({});
    expect(interpolateAtmosphericData(full, absent, 0.5).humidity).toBeUndefined();
    expect(interpolateAtmosphericData(absent, full, 0.5).visibility).toBeUndefined();
    expect(interpolateAtmosphericData(absent, full, 1)).toEqual(full);
    expect(interpolateAtmosphericData(full, absent, 0)).toEqual(full);
    const data = await mock();
    data.hourly = [{ ...data.hourly[0], time: data.current.time + 10800, humidity: undefined, visibility: undefined, dewPoint: undefined }];
    const samples = hourlySamples(data);
    expect(samples[0].humidity).toBeDefined();
    expect(samples.slice(1).every(s => s.humidity == null && s.visibility == null && s.dewPoint == null)).toBe(true);
  });

  it("calculates the selected hour's atmosphere and paints the sky from it (WTH-046L)", async () => {
    const data = await mock();
    data.hourly[0] = { ...data.hourly[0], humidity: 98, visibility: 0.2, dewPoint: data.hourly[0].temp };
    data.hourly[1] = { ...data.hourly[1], humidity: 20, visibility: 30, dewPoint: data.hourly[1].temp - 15 };
    const frames = buildTimeline(data).frames;
    const fog = frameLook(frames[1]);
    const clear = frameLook(frames[2]);
    expect(fog.atmosphere.haze).toBeGreaterThan(0.99);
    expect(clear.atmosphere.haze).toBe(0);
    const f = frames[1];
    // The page's palette is the atmosphere's at the frame's solar phase, no longer the categorical one
    expect(fog.palette).toEqual(atmospherePalette(f.light, fog.atmosphere));
    // The measured fog and the measured clear hour an hour apart paint different skies: the measurements reach the colours
    expect([fog.palette.sky1, fog.palette.sky2, fog.palette.sky3].join()).not.toBe([clear.palette.sky1, clear.palette.sky2, clear.palette.sky3].join());
    expect(fog.palette.air.depth).toBeLessThan(0.1);
    expect(clear.palette.air.depth).toBe(1);
    expect(frameLook(JSON.parse(JSON.stringify(f)))).toEqual(fog);
  });

  it("marks daily overviews synthetic and excludes their maxima/placeholders from normalization", async () => {
    const timeline = buildTimeline(await mock());
    const day = timeline.days.at(-1)!;
    expect(day.hours).toEqual([]);
    expect(day.overview.measured).toBe(false);
    expect(day.overview.overview).toBe(true);
    const look = frameLook({ ...day.overview, condition: "rain", intensity: "heavy", precipitation: 0, temp: 42, uv: 12 });
    expect(look.atmosphere.wetness).toBeGreaterThan(0);
    expect(look.atmosphere.warmth).toBe(0);
    for (const key of ["humidity", "visibility", "dewPoint", "precipitation", "temp", "cloudCover", "uvIndex"] as const) {
      expect(look.atmosphereInputStatus[key]).toBe("missing");
    }
  });
});
