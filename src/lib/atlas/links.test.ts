import { describe, expect, it } from "vitest";
import { createHref, placeHref } from "@/lib/place";
import { atlasHref, placeRefOf } from "./links";

/* The path between Explore, the Atlas and Create. Pure. */

const cell = { lat: 45.07, lon: 7.69 };

describe("a point as a place for the other pages", () => {
  it("is its coordinates and the town it is in", () => {
    expect(placeRefOf({ cell, place: { country: "Italia", place: "Torino", locality: "Borgo Vanchiglia", nearKm: 0.4 } })).toEqual({ lat: 45.07, lon: 7.69, name: "Torino" });
  });

  it("is its coordinates alone when the nearest town is far: a field is not called by a town's name", () => {
    expect(placeRefOf({ cell, place: { country: "Italia", place: "Courmayeur", nearKm: 8.2 } })).toEqual({ lat: 45.07, lon: 7.69 });
  });

  it("is its coordinates alone with no place (the open sea, no token) or no town", () => {
    expect(placeRefOf({ cell, place: null })).toEqual({ lat: 45.07, lon: 7.69 });
    expect(placeRefOf({ cell, place: { country: "Italia", region: "Piemonte" } })).toEqual({ lat: 45.07, lon: 7.69 });
  });

  it("takes the province when there is no town, as a title would", () => {
    expect(placeRefOf({ cell, place: { district: "Cuneo", nearKm: 1 } })).toMatchObject({ name: "Cuneo" });
  });

  it("makes addresses Create and the weather page take", () => {
    const ref = placeRefOf({ cell, place: { place: "Torino", nearKm: 0.4 } });
    expect(createHref(ref)).toBe("/crea?lat=45.0700&lon=7.6900&name=Torino");
    expect(placeHref(ref)).toBe("/?lat=45.0700&lon=7.6900&name=Torino");
  });
});

describe("the Atlas opened on a place", () => {
  it("carries the place's cell", () => {
    expect(atlasHref({ lat: 45.0712, lon: 7.6869 })).toBe("/atlas?lat=45.07&lon=7.69");
    expect(atlasHref({ lat: -33.87, lon: 151.21 })).toBe("/atlas?lat=-33.87&lon=151.21");
  });
});
