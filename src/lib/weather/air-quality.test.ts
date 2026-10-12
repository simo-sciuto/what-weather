import { describe, expect, it } from "vitest";
import { airIndexOf, airInfo, AQI_LABELS } from "./details";
import { toAirQuality, type OWAirPollution } from "@/lib/api/providers/openweather-transformers";
import type { Pollutants } from "@/types/weather";

/*
 * WTH-001: the page's 1-5 air index has two origins. OpenWeather gives its own `main.aqi`; Open-Meteo gives only
 * concentrations, from which `airIndexOf` works the index out. These tests pin what is known about the two
 * (checked 2026-10-04) so a change to one cannot silently part them.
 */

/**
 * OpenWeather's published table (https://openweathermap.org/api/air-pollution), the lower bound in ug/m3 of
 * Fair, Moderate, Poor and Very Poor for each pollutant. Copied here, not imported, so a change to the code's
 * table is caught against the source.
 */
const PUBLISHED: Record<keyof Pollutants, [number, number, number, number]> = {
  so2: [20, 80, 250, 350],
  no2: [40, 70, 150, 200],
  pm10: [20, 50, 100, 200],
  pm2_5: [10, 25, 50, 75],
  o3: [60, 100, 140, 180],
  co: [4400, 9400, 12400, 15400],
};
const KEYS = Object.keys(PUBLISHED) as (keyof Pollutants)[];
/** Every pollutant at the bottom of the scale (band 1) */
const CLEAN: Pollutants = { pm2_5: 0, pm10: 0, o3: 0, no2: 0, so2: 0, co: 0 };

describe("the air index from concentrations (Open-Meteo's path)", () => {
  it("is band 1 for clean air, and each pollutant's published lower bounds open bands 2 to 5, the bound itself included", () => {
    expect(airIndexOf(CLEAN)).toBe(1);
    for (const key of KEYS)
      PUBLISHED[key].forEach((bound, i) => {
        expect(airIndexOf({ ...CLEAN, [key]: bound }), `${key} at ${bound}`).toBe(i + 2);
        expect(airIndexOf({ ...CLEAN, [key]: bound - 0.01 }), `${key} just under ${bound}`).toBe(i + 1);
      });
  });

  it("is the worst band of any pollutant: one bad pollutant sets the index, and the others cannot lower it", () => {
    for (const key of KEYS)
      for (let band = 1; band <= 5; band++) {
        const value = band === 1 ? 0 : PUBLISHED[key][band - 2];
        expect(airIndexOf({ ...CLEAN, [key]: value }), `${key} in band ${band}`).toBe(band);
      }
    // Mixed: PM10 in band 2, O3 in band 4, the rest clean: 4
    expect(airIndexOf({ ...CLEAN, pm10: 30, o3: 150 })).toBe(4);
  });

  it("never lowers when any pollutant rises", () => {
    for (const key of KEYS) {
      let last = 0;
      for (let v = 0; v <= PUBLISHED[key][3] * 1.6; v += PUBLISHED[key][3] / 200) {
        const index = airIndexOf({ ...CLEAN, [key]: v });
        expect(index, `${key} at ${v}`).toBeGreaterThanOrEqual(last);
        last = index;
      }
    }
  });
});

describe("the air index from OpenWeather (its own)", () => {
  const raw = (aqi: number, c: Partial<Pollutants> = {}): OWAirPollution => ({
    list: [{ dt: 1000, main: { aqi }, components: { co: 300, no2: 10, o3: 30, so2: 3, pm2_5: 5, pm10: 12, ...c } }],
  });

  it("keeps the provider's index and clamps it to 1 to 5, never recomputing it from the concentrations", () => {
    expect(toAirQuality(raw(3))?.index).toBe(3);
    expect(toAirQuality(raw(0))?.index).toBe(1);
    expect(toAirQuality(raw(9))?.index).toBe(5);
    expect(toAirQuality(raw(2.6))?.index).toBe(3);
    // Where the provider and the table part (clean air, an index of 4): the page shows the provider's, as it was
    const parted = toAirQuality(raw(4));
    expect(parted?.index).toBe(4);
    expect(airIndexOf(parted!.pollutants)).toBe(1);
  });

  it("carries the six pollutants the index rests on and no other: ammonia and nitrogen monoxide do not enter it", () => {
    expect(Object.keys(toAirQuality(raw(1))!.pollutants).sort()).toEqual(["co", "no2", "o3", "pm10", "pm2_5", "so2"]);
    expect(toAirQuality({ list: [] })).toBeNull();
  });

  it("agrees with the table on the sample data both providers' paths use (the mock gives OpenWeather-shaped readings)", () => {
    // The mock's concentrations for each band, as `mock.ts` writes them: the band is the same by either route
    const sample: Record<number, Pollutants> = {
      1: { pm2_5: 5, pm10: 12, o3: 40, no2: 15, so2: 4, co: 300 },
      2: { pm2_5: 18, pm10: 35, o3: 80, no2: 55, so2: 30, co: 5000 },
      3: { pm2_5: 38, pm10: 75, o3: 120, no2: 110, so2: 120, co: 10000 },
      4: { pm2_5: 62, pm10: 150, o3: 160, no2: 175, so2: 300, co: 13000 },
      5: { pm2_5: 90, pm10: 230, o3: 200, no2: 230, so2: 380, co: 16000 },
    };
    for (const [aqi, p] of Object.entries(sample)) expect(airIndexOf(p), `aqi ${aqi}`).toBe(Number(aqi));
  });
});

describe("what the page says of the index", () => {
  it("names the five bands for what the air does to you, calls 3 and over poor, and finds the pollutant that drives it", () => {
    expect([...AQI_LABELS]).toEqual(["Buona", "Discreta", "Scarsa", "Molto scarsa", "Pessima"]);
    const high = airInfo({ time: 1, index: 4, pollutants: { ...CLEAN, pm2_5: 60, o3: 150 } });
    expect(high.label).toBe("Molto scarsa");
    expect(high.poor).toBe(true);
    expect(high.dominant.key).toBe("pm2_5");
    expect(airInfo({ time: 1, index: 2, pollutants: { ...CLEAN, pm10: 30 } }).poor).toBe(false);
  });
});
