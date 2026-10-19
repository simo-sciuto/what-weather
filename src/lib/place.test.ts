import { describe, expect, it } from "vitest";
import { DEFAULT_PLACE } from "@/constants/weather";
import { createHref, createPlaceRef, placeHref } from "./place";

describe("createPlaceRef", () => {
  it("takes the place in the address", () => {
    expect(createPlaceRef({ lat: "64.1466", lon: "-21.9426", name: "Reykjavik" })).toEqual({
      lat: 64.1466,
      lon: -21.9426,
      name: "Reykjavik",
      region: undefined,
      country: undefined,
    });
  });

  it("falls back to the default place, never a random one, when the address has none", () => {
    for (const raw of [{}, { lat: "x", lon: "9" }, { lat: "91", lon: "9" }, { name: "Roma" }]) {
      expect(createPlaceRef(raw)).toBe(DEFAULT_PLACE);
    }
  });
});

describe("createHref", () => {
  it("is the place's address on the Create page", () => {
    const place = { lat: 45.0703, lon: 7.6869, name: "Torino", region: "Piemonte", country: "IT" };
    expect(createHref(place)).toBe("/crea?lat=45.0703&lon=7.6869&name=Torino&region=Piemonte&country=IT");
    expect(createHref(place).replace("/crea", "/")).toBe(placeHref(place));
  });

  it("carries the moment on show as its instant, and the current conditions when there is no moment (WTH-236)", () => {
    const place = { lat: 45.0703, lon: 7.6869, name: "Torino" };
    expect(createHref(place, 1_790_000_000)).toBe("/crea?lat=45.0703&lon=7.6869&name=Torino&t=1790000000");
    expect(createHref(place)).not.toMatch(/[?&]t=/);
  });
});
