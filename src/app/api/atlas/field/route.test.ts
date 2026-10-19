import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FIELD_MAX_POINTS } from "@/constants/atlas";

/* ADR-026: the field route, with the source and the provider stood in for. */

const weatherField = vi.fn();
const sampleField = vi.fn();
const provider = { name: "open-meteo" };
vi.mock("@/lib/api/sources/weather-field", () => ({ weatherField: (...a: unknown[]) => weatherField(...a), sampleField: (...a: unknown[]) => sampleField(...a) }));
vi.mock("@/lib/api/providers/get-provider", () => ({ getProvider: () => provider }));

import { GET } from "./route";

const call = (query: string) => GET(new NextRequest(`http://localhost/api/atlas/field?${query}`));
const VIEW = "west=6.6&south=36.6&east=18.5&north=47.1";
const FIELD = { step: 4, lats: [44, 48], lons: [8, 12], provider: "open-meteo", time: 1, colors: ["#000000"], temps: [1] };

beforeEach(() => {
  provider.name = "open-meteo";
  weatherField.mockReset().mockResolvedValue(FIELD);
  sampleField.mockReset().mockReturnValue({ ...FIELD, provider: "mock" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("the field route", () => {
  it("refuses a box that is missing, empty, not a number or out of the world", async () => {
    for (const q of ["", "west=1&south=2&east=3", "west=&south=1&east=2&north=3", "west=a&south=1&east=2&north=3", "west=1&south=-95&east=2&north=3", "west=1&south=1&east=2&north=91", "west=5000&south=1&east=6000&north=3"]) {
      expect((await call(q)).status, q).toBe(400);
    }
    expect(weatherField).not.toHaveBeenCalled();
  });

  it("asks for a lattice on the grid, and answers with the field, cacheable for a while", async () => {
    const response = await call(VIEW);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(FIELD);
    const [step, lats, lons] = weatherField.mock.calls[0] as [number, number[], number[]];
    expect(lats.length * lons.length).toBeLessThanOrEqual(FIELD_MAX_POINTS);
    for (const v of [...lats, ...lons]) expect(Math.abs(v / step - Math.round(v / step))).toBeLessThan(1e-3);
    expect(response.headers.get("cache-control")).toMatch(/max-age/);
  });

  it("never asks for more places than the cap, whatever the box says", async () => {
    await call("west=-1000&south=-90&east=1000&north=90");
    const [, lats, lons] = weatherField.mock.calls[0] as [number, number[], number[]];
    expect(lats.length * lons.length).toBeLessThanOrEqual(FIELD_MAX_POINTS);
  });

  it("asks for the same lattice for views nudged within the grid, so they share one cache entry", async () => {
    await call("west=7.61&south=45.02&east=7.9&north=45.2");
    await call("west=7.63&south=45.03&east=7.88&north=45.19");
    expect(weatherField.mock.calls[0]).toEqual(weatherField.mock.calls[1]);
  });

  it("is a made-up field, not cached, where the sample weather is the provider, and asks nobody", async () => {
    provider.name = "mock";
    const response = await call(VIEW);
    expect((await response.json()).provider).toBe("mock");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(weatherField).not.toHaveBeenCalled();
  });

  it("is a 502 with no detail for the caller when the source fails, and is logged", async () => {
    weatherField.mockRejectedValue(new Error("limit reached"));
    const response = await call(VIEW);
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("limit reached");
    expect(console.error).toHaveBeenCalled();
  });
});
