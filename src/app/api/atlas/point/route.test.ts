import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FIXTURE_SKY } from "@/lib/atlas/sky.fixture";

/*
 * ADR-022, M4: the point route with the shared weather cache stood in for. It checks what the route decides itself: which
 * coordinates it accepts, which cell it asks for, what of the query it lets into the cache key, and how it fails.
 */

const weatherFor = vi.fn();
vi.mock("@/lib/weather-page", () => ({ weatherFor: (...args: unknown[]) => weatherFor(...args) }));

vi.mock("@/lib/weather/look", () => ({ frameLook: () => ({ palette: { ...FIXTURE_SKY, map: {} } }) }));

import { GET } from "./route";

const sample = {
  data: { timezone: "Europe/Rome", current: { time: 1_760_000_000, temp: 17.4, condition: "clear", intensity: "none", cloudCover: 5 } },
  timeline: { frames: [{ phase: "day" }] },
  provider: "openweather",
};

const call = (query: string) => GET(new NextRequest(`http://localhost/api/atlas/point?${query}`));
const env = { ...process.env };

beforeEach(() => {
  weatherFor.mockReset().mockResolvedValue(sample);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  process.env = { ...env };
  vi.restoreAllMocks();
});

describe("the point route", () => {
  it("refuses no coordinates, an empty one (it would read as 0) and a wrong one", async () => {
    for (const q of ["", "lat=45", "lat=&lon=", "lat=45&lon=", "lat=95&lon=7", "lat=x&lon=7"]) {
      expect((await call(q)).status, q).toBe(400);
    }
    expect(weatherFor).not.toHaveBeenCalled();
  });

  it("asks for the cell, not the point, and answers with the reading in a few numbers", async () => {
    const response = await call("lat=45.0712&lon=7.6869");
    expect(response.status).toBe(200);
    expect(weatherFor.mock.calls[0][0]).toEqual({ lat: 45.07, lon: 7.69 });
    expect(await response.json()).toMatchObject({ sky: FIXTURE_SKY, cell: { lat: 45.07, lon: 7.69 }, timezone: "Europe/Rome", provider: "openweather", time: 1_760_000_000, temp: 17.4, condition: "clear", night: false });
  });

  it("brings a longitude beyond the antimeridian back into the same cell", async () => {
    await call("lat=10&lon=179.999");
    expect(weatherFor.mock.calls[0][0]).toEqual({ lat: 10, lon: -180 });
  });

  it("is a free point: a name, a region and a country in the query are not passed on", async () => {
    await call("lat=45.07&lon=7.69&name=Torino&region=Piemonte&country=IT");
    expect(weatherFor.mock.calls[0][0]).toEqual({ lat: 45.07, lon: 7.69 });
  });

  it("with a live provider in production, `mock` and `at` are not part of the cache key and the answer may be cached", async () => {
    process.env = { ...env, NODE_ENV: "production", WEATHER_PROVIDER: "open-meteo" };
    const response = await call("lat=45.07&lon=7.69&mock=rain&at=09:00");
    expect(weatherFor.mock.calls[0].slice(1)).toEqual([undefined, undefined]);
    expect(response.headers.get("cache-control")).toMatch(/max-age/);
  });

  it("with the sample weather, `mock` and `at` pick the sky and the hour, and the answer is not cached", async () => {
    process.env = { ...env, NODE_ENV: "production", WEATHER_PROVIDER: "mock" };
    const response = await call("lat=45.07&lon=7.69&mock=rain&at=09:00");
    expect(weatherFor.mock.calls[0].slice(1)).toEqual(["rain", "09:00"]);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("says it at night, from the first frame", async () => {
    weatherFor.mockResolvedValue({ ...sample, timeline: { frames: [{ phase: "night" }] } });
    expect((await (await call("lat=45.07&lon=7.69")).json()).night).toBe(true);
  });

  it("a failure of the weather is a 502 with no detail for the caller, and is logged", async () => {
    weatherFor.mockRejectedValue(new Error("upstream down"));
    const response = await call("lat=45.07&lon=7.69");
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("upstream down");
    expect(console.error).toHaveBeenCalled();
  });
});
