import { describe, expect, it, vi } from "vitest";
import { fetchRouteWeather, parseSample, sampleSpot } from "./route-weather";

/* ADR-031: the weather at a height, as Open-Meteo writes it. No network. */

const SPOT = { lat: 45.2, lon: 7.07, ele: 3538 };
const RAW = {
  hourly: {
    time: [1000, 4600],
    temperature_2m: [-4, null],
    apparent_temperature: [-9, -10],
    precipitation: [0, 0.4],
    precipitation_probability: [10, 55],
    snowfall: [0, 0.3],
    weather_code: [0, 95],
    wind_gusts_10m: [40, 60],
    wind_speed_700hPa: [35, 52],
    freezing_level_height: [3300, 3100],
    cape: [120, null],
    cloud_cover_low: [5, 90],
    visibility: [24000, 800],
    is_day: [1, 0],
  },
  daily: { sunrise: [500], sunset: [40000] },
};

describe("parseSample", () => {
  it("keeps every hour in the project's units, probabilities as 0..1, visibility in km", () => {
    const s = parseSample(RAW, SPOT);
    expect(s.ele).toBe(3538);
    expect(s.hours[0]).toMatchObject({ temp: -4, precipProbability: 0.1, visibility: 24, freeWind: 35, condition: "clear", isNight: false });
    expect(s.hours[1]).toMatchObject({ condition: "thunderstorm", isNight: true, visibility: 0.8 });
    expect(s.sun).toEqual([{ sunrise: 500, sunset: 40000 }]);
  });

  it("leaves a missing value missing, never a zero", () => {
    const s = parseSample(RAW, SPOT);
    expect(s.hours[1].temp).toBeNull();
    expect(s.hours[1].cape).toBeNull();
  });

  it("is an error, not an empty summit, when there are no hours", () => {
    expect(() => parseSample({}, SPOT)).toThrow();
  });
});

describe("fetchRouteWeather", () => {
  it("asks once, with the height of each spot and the variables the verdict needs", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(JSON.stringify(RAW))));
    const out = await fetchRouteWeather([SPOT], fetchImpl);
    const url = new URL(String((fetchImpl.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get("elevation")).toBe("3538");
    for (const v of ["freezing_level_height", "cape", "wind_speed_700hPa", "snowfall"]) expect(url.searchParams.get("hourly")).toContain(v);
    expect(out.provenance.source).toBe("open-meteo");
  });
});

describe("sampleSpot", () => {
  it("is three days of hours, colder higher up, labelled as the sample", () => {
    const low = sampleSpot({ lat: 45, lon: 7, ele: 500 });
    const high = sampleSpot({ lat: 45, lon: 7, ele: 3500 });
    expect(low.samples[0].hours).toHaveLength(72);
    expect(high.samples[0].hours[0].temp!).toBeLessThan(low.samples[0].hours[0].temp!);
    expect(high.provenance.source).toBe("mock");
  });
});
