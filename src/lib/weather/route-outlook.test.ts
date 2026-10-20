import { describe, expect, it } from "vitest";
import type { RouteWeatherHour, RouteWeatherSample } from "@/types/route";
import { peakOutlook, windChill } from "./route-outlook";

/* WTH-354, docs/VERDICT.md: the summit's verdict, with the cases the weather-data agent set out. No network. */

const H = 3600;
const NOW = 1_792_490_400; // a Tuesday morning
const NOON = NOW + 6 * H;

const calm = (time: number): RouteWeatherHour => ({
  time,
  temp: 8,
  apparentTemp: 7,
  condition: "clear",
  intensity: "moderate",
  precipitation: 0,
  precipProbability: 0.05,
  snowfall: 0,
  windGust10m: 20,
  freeWind: 15,
  freezingLevel: 4200,
  cape: 50,
  lowCloud: 10,
  visibility: 30,
  isNight: false,
});

const peak = (ele: number, change: (h: RouteWeatherHour) => Partial<RouteWeatherHour> = () => ({})): RouteWeatherSample => ({
  lat: 45.2,
  lon: 7.07,
  ele,
  hours: Array.from({ length: 96 }, (_, i) => {
    const h = calm(NOW + i * H);
    return { ...h, ...change(h) };
  }),
  sun: [{ sunrise: NOW - 3 * H, sunset: NOW + 11 * H }],
});

describe("peakOutlook", () => {
  it("a calm day tomorrow is Buon momento, with nothing to say against it", () => {
    const out = peakOutlook(peak(2000), NOON, NOW);
    expect(out.verdict).toBe("good");
    expect(out.word).toBe("Buon momento.");
    expect(out.reasons).toEqual([]);
    expect(out.certainty).toBe("alta");
  });

  it("a storm at the summit's hour, or in the three hours of the way down, is Non ora; after them it does not count", () => {
    expect(peakOutlook(peak(3841, (h) => (h.time === NOON + 2 * H ? { condition: "thunderstorm" } : {})), NOON, NOW).verdict).toBe("no");
    expect(peakOutlook(peak(3841, (h) => (h.time === NOON + 2 * H ? { condition: "thunderstorm" } : {})), NOON, NOW).reasons[0].factor).toBe("storm");
    expect(peakOutlook(peak(3841, (h) => (h.time === NOON + 4 * H ? { condition: "thunderstorm" } : {})), NOON, NOW).verdict).toBe("good");
  });

  it("unstable air: CAPE with rain likely is Non ora, alone is Con riserva and lowers the certainty", () => {
    expect(peakOutlook(peak(2000, () => ({ cape: 1200, precipProbability: 0.4 })), NOON, NOW).verdict).toBe("no");
    const alone = peakOutlook(peak(2000, () => ({ cape: 600 })), NOON, NOW);
    expect(alone.verdict).toBe("caution");
    expect(alone.certainty).toBe("media");
  });

  it("rain: likely is Non ora, some is Con riserva, little is fine", () => {
    expect(peakOutlook(peak(2000, () => ({ precipProbability: 0.6, condition: "rain" })), NOON, NOW).verdict).toBe("no");
    expect(peakOutlook(peak(2000, () => ({ precipProbability: 0.3 })), NOON, NOW).verdict).toBe("caution");
    expect(peakOutlook(peak(2000, () => ({ precipProbability: 0.15 })), NOON, NOW).verdict).toBe("good");
  });

  it("a freezing level under the summit plus 300 m is Con riserva and says it; snow at the summit is Non ora", () => {
    const low = peakOutlook(peak(3538, () => ({ freezingLevel: 3300 })), NOON, NOW);
    expect(low.verdict).toBe("caution");
    expect(low.reasons[0].text).toContain("possibile neve o ghiaccio");
    expect(peakOutlook(peak(3538, () => ({ freezingLevel: 3900 })), NOON, NOW).verdict).toBe("good");
    expect(peakOutlook(peak(3538, () => ({ snowfall: 0.5 })), NOON, NOW).verdict).toBe("no");
  });

  it("wind: free-air wind counts only on high summits, gusts everywhere", () => {
    expect(peakOutlook(peak(3538, () => ({ freeWind: 55 })), NOON, NOW).verdict).toBe("no");
    expect(peakOutlook(peak(3538, () => ({ freeWind: 40 })), NOON, NOW).verdict).toBe("caution");
    expect(peakOutlook(peak(1400, () => ({ freeWind: 60 })), NOON, NOW).verdict).toBe("good");
    expect(peakOutlook(peak(1400, () => ({ windGust10m: 75 })), NOON, NOW).verdict).toBe("no");
    expect(peakOutlook(peak(1400, () => ({ windGust10m: 55 })), NOON, NOW).verdict).toBe("caution");
  });

  it("wind chill as JAG/TI computes it", () => {
    expect(windChill(-8, 40)).toBeCloseTo(-18.1, 1);
    expect(windChill(-15, 50)).toBeCloseTo(-28.6, 1);
    expect(windChill(12, 40)).toBe(12);
  });

  it("a missing value is never fine: one critical missing is Con riserva and less sure, two are no verdict", () => {
    const one = peakOutlook(peak(3538, () => ({ freezingLevel: null })), NOON, NOW);
    expect(one.verdict).toBe("caution");
    expect(one.notEvaluated).toContain("zero termico");
    expect(peakOutlook(peak(3538, () => ({ freezingLevel: null, freeWind: null })), NOON, NOW).verdict).toBe("unknown");
    // a missing value never hides a bad one
    expect(peakOutlook(peak(2000, () => ({ freezingLevel: null, precipProbability: 0.7, condition: "rain" })), NOON, NOW).verdict).toBe("no");
    expect(peakOutlook(peak(2000, () => ({ condition: null })), NOON, NOW).verdict).toBe("unknown");
  });

  it("the horizon: 56 hours ahead is an indication, beyond 72 no verdict, a past hour neither", () => {
    const later = peakOutlook(peak(2000), NOW + 53 * H, NOW);
    expect(later.indicative).toBe(true);
    expect(later.certainty).toBe("bassa");
    expect(peakOutlook(peak(2000), NOW + 71 * H, NOW).verdict).toBe("unknown");
    expect(peakOutlook(peak(2000), NOW - 5 * H, NOW).verdict).toBe("unknown");
  });

  it("never says sicuro, never misurato", () => {
    const samples = [peak(3841, () => ({ condition: "thunderstorm", freeWind: 60, freezingLevel: 3000, temp: -10, lowCloud: 90 })), peak(1000)];
    for (const s of samples) {
      const out = peakOutlook(s, NOON, NOW);
      const words = [out.word, out.why ?? "", ...out.reasons.map((r) => r.text)].join(" ");
      expect(words).not.toMatch(/sicur|misurat/i);
    }
  });
});
