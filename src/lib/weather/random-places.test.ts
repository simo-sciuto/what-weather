import { describe, expect, it } from "vitest";
import { RANDOM_PLACES, randomPlace } from "./random-places";

describe("random places", () => {
  it("are real coordinates with a name, a region and a country", () => {
    for (const p of RANDOM_PLACES) {
      expect(Math.abs(p.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(p.lon)).toBeLessThanOrEqual(180);
      expect(p.name && p.region && p.country).toBeTruthy();
      expect(p.country).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("never repeat a city", () => {
    expect(new Set(RANDOM_PLACES.map((p) => p.name)).size).toBe(RANDOM_PLACES.length);
  });

  it("draws from the list", () => {
    for (let i = 0; i < 50; i++) expect(RANDOM_PLACES).toContain(randomPlace());
  });
});
