import { describe, expect, it } from "vitest";
import { createHref, placeHref } from "./place";

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
