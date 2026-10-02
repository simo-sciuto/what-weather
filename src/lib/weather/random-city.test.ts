import { describe, expect, it } from "vitest";
import { pickCity, type GeoPlace } from "./random-city";

const place = (over: Partial<GeoPlace>): GeoPlace => ({
  name: "Posto",
  latitude: 10,
  longitude: 20,
  feature_code: "PPL",
  country_code: "IT",
  ...over,
});

describe("pickCity", () => {
  it("draws any of the populated places, a hamlet as well as a city", () => {
    const candidates = [
      place({ name: "Casale", population: 40 }),
      place({ name: "Città", feature_code: "PPLA", population: 90_000 }),
      place({ name: "Paese", population: 3_000 }),
    ];
    expect(pickCity(candidates, () => 0)?.name).toBe("Casale");
    expect(pickCity(candidates, () => 0.5)?.name).toBe("Città");
    expect(pickCity(candidates, () => 0.99)?.name).toBe("Paese");
  });

  it("ignores what is not a populated place today (a mountain, a ruin, a quarter)", () => {
    expect(
      pickCity([
        place({ name: "Monte", feature_code: "MT", population: 9_000_000 }),
        place({ name: "Rovine", feature_code: "PPLQ", population: 9_000_000 }),
        place({ name: "Rione", feature_code: "PPLX", population: 9_000_000 }),
      ]),
    ).toBeNull();
  });

  it("ignores places without a name or coordinates", () => {
    expect(
      pickCity([place({ name: undefined }), place({ latitude: undefined })]),
    ).toBeNull();
  });

  it("carries the region and the country along", () => {
    expect(
      pickCity([
        place({ name: "Lecco", admin1: "Lombardia", country_code: "IT" }),
      ]),
    ).toEqual({
      name: "Lecco",
      lat: 10,
      lon: 20,
      region: "Lombardia",
      country: "IT",
    });
  });
});
