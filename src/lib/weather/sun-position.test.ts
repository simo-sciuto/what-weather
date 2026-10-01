import { describe, expect, it } from "vitest";
import { sunPosition } from "./sun-position";

const at = (iso: string) => Date.parse(iso) / 1000;

describe("sunPosition", () => {
  it("stands at 90 minus the latitude plus the tilt at the summer solstice's noon", () => {
    // London, 21 June, close to solar noon: 90 - 51.5 + 23.44 = 61.9 degrees, due south
    const sun = sunPosition(at("2026-06-21T12:00:00Z"), 51.5, 0);
    expect(sun.altitude).toBeGreaterThan(61);
    expect(sun.altitude).toBeLessThan(63);
    expect(Math.abs(sun.azimuth - 180)).toBeLessThan(5);
  });

  it("is overhead at the equator on the equinox's noon", () => {
    expect(sunPosition(at("2026-03-20T12:00:00Z"), 0, 0).altitude).toBeGreaterThan(87);
  });

  it("rises in the east and sets in the west", () => {
    const morning = sunPosition(at("2026-09-30T06:30:00Z"), 45.07, 7.68);
    const evening = sunPosition(at("2026-09-30T16:00:00Z"), 45.07, 7.68);
    expect(morning.azimuth).toBeLessThan(180);
    expect(evening.azimuth).toBeGreaterThan(180);
    expect(morning.altitude).toBeGreaterThan(0);
  });

  it("is below the horizon at midnight", () => {
    expect(sunPosition(at("2026-09-30T23:30:00Z"), 45.07, 7.68).altitude).toBeLessThan(-20);
  });
});
