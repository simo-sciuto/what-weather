import { describe, expect, it, vi } from "vitest";
import { parseReverse, reverseGeocode } from "./reverse-geocode";

/* ADR-024: reverse geocoding, with the features as Mapbox's v6 writes them (checked against the live service on 2026-10-18). No network. */

const CELL = { lat: 45.07, lon: 7.69 };
const VANCHIGLIA = {
  features: [
    {
      geometry: { type: "Point", coordinates: [7.7041, 45.0745] },
      properties: {
        feature_type: "locality",
        name: "Borgo Vanchiglia",
        coordinates: { longitude: 7.7041, latitude: 45.0745 },
        context: { place: { name: "Torino" }, region: { name: "città metropolitana di Torino" }, country: { name: "Italia" }, locality: { name: "Borgo Vanchiglia" } },
      },
    },
  ],
};
const ISOLABELLA = {
  features: [{ properties: { feature_type: "place", name: "Isolabella", coordinates: { longitude: 7.91, latitude: 44.9067 }, context: { region: { name: "città metropolitana di Torino" }, country: { name: "Italia" }, place: { name: "Isolabella" } } } }],
};

describe("parseReverse", () => {
  it("reads the levels from the context, and the feature's own name at its own level", () => {
    expect(parseReverse(VANCHIGLIA, CELL)).toMatchObject({ country: "Italia", region: "città metropolitana di Torino", place: "Torino", locality: "Borgo Vanchiglia" });
    expect(parseReverse({ features: [{ properties: { feature_type: "country", name: "Italia", context: {} } }] }, CELL)).toMatchObject({ country: "Italia" });
  });

  it("says how far the finest name's own point is from the cell, in kilometres", () => {
    expect(parseReverse(ISOLABELLA, { lat: 44.9, lon: 7.9 })?.nearKm).toBeLessThan(2);
    expect(parseReverse(ISOLABELLA, CELL)?.nearKm).toBeGreaterThan(20);
  });

  it("is null for no feature (the open sea), for nothing but a distance, and for anything that is not an answer", () => {
    expect(parseReverse({ type: "FeatureCollection", features: [] }, CELL)).toBeNull();
    expect(parseReverse({ features: [{ properties: { coordinates: { latitude: 1, longitude: 2 } } }] }, CELL)).toBeNull();
    for (const junk of [null, undefined, "x", 3, {}, { features: "no" }, { features: [null] }]) expect(parseReverse(junk, CELL)).toBeNull();
  });

  it("keeps only text for names, and trims it", () => {
    const body = { features: [{ properties: { feature_type: "place", name: "  Torino  ", context: { country: { name: 5 }, region: { name: "" } } } }] };
    expect(parseReverse(body, CELL)).toEqual({ country: undefined, region: undefined, district: undefined, place: "Torino", locality: undefined });
  });
});

describe("reverseGeocode", () => {
  const ok = (body: unknown, status = 200) => vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));

  it("asks Mapbox for the cell's centre, in Italian, one result, from the quarter up to the country", async () => {
    const fetchImpl = ok(VANCHIGLIA);
    const names = await reverseGeocode(CELL, { token: "pk.test", fetchImpl });
    expect(names?.place).toBe("Torino");
    const url = new URL(String((fetchImpl.mock.calls[0] as unknown[])[0]));
    expect(url.origin + url.pathname).toBe("https://api.mapbox.com/search/geocode/v6/reverse");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ longitude: "7.69", latitude: "45.07", language: "it", limit: "1", access_token: "pk.test" });
    expect(url.searchParams.get("types")).toBe("neighborhood,locality,place,district,region,country");
  });

  it("does not let the result be stored: the request is not cached", async () => {
    const fetchImpl = ok(VANCHIGLIA);
    await reverseGeocode(CELL, { token: "pk.test", fetchImpl });
    expect((fetchImpl.mock.calls[0] as unknown[])[1]).toMatchObject({ cache: "no-store" });
  });

  it("is null, and never throws, with no token, a refusal, a network failure, a slow answer or nothing found", async () => {
    expect(await reverseGeocode(CELL, { token: "", fetchImpl: ok(VANCHIGLIA) })).toBeNull();
    expect(await reverseGeocode(CELL, { token: "pk.test", fetchImpl: ok({}, 401) })).toBeNull();
    expect(await reverseGeocode(CELL, { token: "pk.test", fetchImpl: () => Promise.reject(new TypeError("offline")) })).toBeNull();
    expect(await reverseGeocode(CELL, { token: "pk.test", fetchImpl: ok({ features: [] }) })).toBeNull();
    const hang = (_u: unknown, init?: RequestInit) => new Promise<Response>((_r, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)));
    expect(await reverseGeocode(CELL, { token: "pk.test", fetchImpl: hang, timeoutMs: 20 })).toBeNull();
  });
});
