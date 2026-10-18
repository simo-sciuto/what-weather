import { describe, expect, it } from "vitest";
import { FLIGHT_MAX_MS, FLIGHT_MIN_MS } from "@/constants/atlas";
import { distanceKm, flightMs } from "./flight";

describe("distance", () => {
  it("is the great-circle distance, in kilometres", () => {
    expect(distanceKm({ lat: 45.07, lon: 7.69 }, { lat: 45.07, lon: 7.69 })).toBe(0);
    expect(distanceKm({ lat: 45.07, lon: 7.69 }, { lat: 45.46, lon: 9.19 })).toBeGreaterThan(118);
    expect(distanceKm({ lat: 45.07, lon: 7.69 }, { lat: 45.46, lon: 9.19 })).toBeLessThan(128);
    expect(distanceKm({ lat: 45.07, lon: 7.69 }, { lat: -33.87, lon: 151.21 })).toBeGreaterThan(15500);
    // the same either way, and across the antimeridian the short way
    expect(distanceKm({ lat: 0, lon: 179 }, { lat: 0, lon: -179 })).toBeCloseTo(distanceKm({ lat: 0, lon: -179 }, { lat: 0, lon: 179 }), 6);
    expect(distanceKm({ lat: 0, lon: 179 }, { lat: 0, lon: -179 })).toBeLessThan(250);
  });
});

describe("how long the flight lasts", () => {
  it("is the minimum for a hop, the maximum from far, and never falls as the distance grows", () => {
    expect(flightMs(0)).toBe(FLIGHT_MIN_MS);
    expect(flightMs(-5)).toBe(FLIGHT_MIN_MS);
    expect(flightMs(20_000)).toBe(FLIGHT_MAX_MS);
    let last = 0;
    for (let km = 0; km <= 20_000; km += 100) {
      expect(flightMs(km)).toBeGreaterThanOrEqual(last);
      last = flightMs(km);
    }
  });

  it("is brisk for a neighbour and long for the other side of the world", () => {
    expect(flightMs(125)).toBeLessThan(2200);
    expect(flightMs(1000)).toBeGreaterThan(flightMs(125));
    expect(flightMs(15_500)).toBe(FLIGHT_MAX_MS);
  });
});
