import { describe, expect, it } from "vitest";
import { computeAtmosphere, type WeatherVisualInput } from "./visual-input";

const state = (input: WeatherVisualInput) => computeAtmosphere(input).atmosphere;

describe("weather measurement normalization", () => {
  it.each([
    [-15, -1], [-5, -0.8], [5, -0.5], [12, -0.25], [18, 0],
    [24, 0.25], [30, 0.6], [36, 0.9], [42, 1],
  ])("maps %s degrees C to warmth %s", (temp, warmth) => {
    expect(state({ temp }).warmth).toBeCloseTo(warmth, 12);
  });

  it("keeps warmth bounded, monotone and continuous through the anchors", () => {
    let previous = -1;
    for (let temp = -30; temp <= 60; temp += 0.1) {
      const warmth = state({ temp }).warmth;
      expect(warmth).toBeGreaterThanOrEqual(previous);
      expect(warmth).toBeLessThanOrEqual(1);
      previous = warmth;
    }
    for (const temp of [-15, -5, 5, 12, 18, 24, 30, 36, 42]) {
      expect(state({ temp: temp + 0.0001 }).warmth - state({ temp: temp - 0.0001 }).warmth).toBeLessThan(0.0001);
    }
  });

  it("eases measured clouds continuously regardless of semantic category", () => {
    expect(state({ cloudCover: 0 }).cloudiness).toBe(0);
    expect(state({ cloudCover: 50 }).cloudiness).toBe(0.5);
    expect(state({ cloudCover: 100 }).cloudiness).toBe(1);
    let previous = 0;
    for (let cloudCover = 0; cloudCover <= 100; cloudCover++) {
      const cloudy = state({ cloudCover, condition: "cloudy" });
      expect(cloudy.cloudiness).toBeGreaterThanOrEqual(previous);
      expect(cloudy).toEqual(state({ cloudCover, condition: "partly-cloudy" }));
      previous = cloudy.cloudiness;
    }
  });

  it("gives visibility more influence than humidity and respects the reference examples", () => {
    const humidClear = state({ humidity: 95, visibility: 18, temp: 20, dewPoint: 19 });
    const lowVisibility = state({ humidity: 85, visibility: 2, temp: 20, dewPoint: 18 });
    expect(humidClear.haze).toBeLessThan(0.5);
    expect(lowVisibility.haze).toBeGreaterThan(0.8);
    expect(state({ humidity: 100 }).haze).toBeCloseTo(0.1);
    expect(state({ visibility: 0 }).haze).toBeCloseTo(0.65);
  });

  it("keeps saturated air under the transform's depth onset and a good view clear in the rain (WTH-046K)", () => {
    const ONSET = 0.45;
    // Saturated air alone: 0.35. Rain with 9 km of view is almost as clear; 4 km of mist closes the depth.
    expect(state({ humidity: 100, temp: 12, dewPoint: 12, visibility: 30 }).haze).toBeLessThan(ONSET);
    expect(state({ humidity: 98, temp: 10, dewPoint: 9.5, visibility: 9, precipitation: 3, condition: "rain" }).haze).toBeLessThan(ONSET);
    expect(state({ humidity: 98, temp: 10, dewPoint: 9.5, visibility: 4, precipitation: 3, condition: "rain" }).haze).toBeGreaterThan(0.75);
    expect(state({ humidity: 100, temp: 8, dewPoint: 8, visibility: 0.3 }).haze).toBeGreaterThan(0.95);
  });

  it("reduces depth monotonically as visibility falls and dew point approaches temperature", () => {
    let previous = 1;
    for (let visibility = 25; visibility >= 0; visibility -= 0.5) {
      const clarity = state({ visibility, humidity: 85, temp: 20, dewPoint: 18 }).clarity;
      expect(clarity).toBeLessThanOrEqual(previous);
      previous = clarity;
    }
    let haze = 0;
    for (let dewPoint = 10; dewPoint <= 22; dewPoint += 0.1) {
      const current = state({ temp: 20, dewPoint }).haze;
      expect(current).toBeGreaterThanOrEqual(haze);
      expect(current).toBeLessThanOrEqual(0.3);
      haze = current;
    }
  });

  it("uses a saturating logarithmic wetness curve, distinct from severity", () => {
    expect(state({ precipitation: 0 }).wetness).toBe(0);
    expect(state({ precipitation: 12 }).wetness).toBe(1);
    const firstIncrement = state({ precipitation: 1 }).wetness - state({ precipitation: 0 }).wetness;
    const laterIncrement = state({ precipitation: 11 }).wetness - state({ precipitation: 10 }).wetness;
    expect(firstIncrement).toBeGreaterThan(laterIncrement);
    let wetness = 0;
    let severity = 0;
    for (let precipitation = 0; precipitation <= 30; precipitation += 0.25) {
      const current = state({ precipitation });
      expect(current.wetness).toBeGreaterThanOrEqual(wetness);
      expect(current.severity).toBeGreaterThanOrEqual(severity);
      expect(current.severity).toBeLessThanOrEqual(0.6);
      wetness = current.wetness;
      severity = current.severity;
    }
    expect(state({ precipitation: 1 }).severity).toBe(0);
    expect(state({ precipitation: 0, condition: "thunderstorm", intensity: "heavy" }).severity).toBe(1);
  });

  it("routes the combined precipitation amount by condition without double counting", () => {
    const snow = state({ condition: "snow", precipitation: 4 });
    const rain = state({ condition: "rain", precipitation: 4 });
    expect(snow.wetness).toBe(0);
    expect(snow.snow).toBeGreaterThan(0);
    expect(rain.snow).toBe(0);
    expect(rain.wetness).toBe(snow.snow);
    expect(snow.severity).toBe(0);
    expect(state({ condition: "snow", intensity: "heavy", precipitation: 0 }).snow).toBe(0);
    expect(state({ condition: "snow", intensity: "heavy" }).snow).toBe(0.9);
  });

  it("uses the existing solar phase gate, with bounded UV energy only in daylight", () => {
    for (const light of [-1, -0.1, 0, 1, 1.2, 2]) {
      expect(state({ light, uvIndex: 12 }).energy).toBe(0);
    }
    for (let light = -1; light <= 2; light += 0.025) {
      const result = state({ light, uvIndex: 100 });
      expect(result.energy).toBeGreaterThanOrEqual(0);
      expect(result.energy).toBeLessThanOrEqual(result.daylight);
    }
    expect(state({ light: 0.5, uvIndex: 8 }).energy).toBe(1);
    expect(state({ light: 0.5, uvIndex: 0 }).energy).toBe(0);
    expect(state({ light: 0.5 }).energy).toBe(0.5);
    expect(state({ light: 0.1, uvIndex: 8 }).daylight).toBeCloseTo(2 * Math.sin(Math.PI / 10));
  });

  it("raises UV energy monotonically without changing warmth", () => {
    let energy = 0;
    for (let uvIndex = 0; uvIndex <= 12; uvIndex += 0.1) {
      const result = state({ light: 0.1, temp: -5, uvIndex });
      expect(result.energy).toBeGreaterThanOrEqual(energy);
      expect(result.warmth).toBeCloseTo(-0.8);
      energy = result.energy;
    }
  });

  it("falls back deterministically without claiming missing input is measured zero", () => {
    const empty = computeAtmosphere({});
    expect(Object.values(empty.inputStatus).every(status => status === "missing")).toBe(true);
    expect(empty.atmosphere.signature).toEqual({ dominant: null, secondary: null });
    expect(empty.atmosphere.clarity).toBe(1);
    expect(state({ condition: "rain", intensity: "light" }).wetness).toBeGreaterThan(0);
    expect(state({ condition: "rain", intensity: "heavy", precipitation: 0 }).wetness).toBe(0);
    expect(state({ condition: "fog" }).haze).toBeCloseTo(0.65);
    expect(state({ condition: "fog", visibility: 20 }).haze).toBe(0);
    expect(state({ condition: "cloudy" }).cloudiness).toBeGreaterThan(0.9);
    expect(state({ condition: "cloudy", cloudCover: 0 }).cloudiness).toBe(0);
    expect(computeAtmosphere({ precipitation: 0 }).inputStatus.precipitation).toBe("supplied");
    expect(computeAtmosphere({ precipitation: null }).inputStatus.precipitation).toBe("missing");
  });

  it("handles invalid numeric input and reports clamping", () => {
    const fields = ["light", "temp", "cloudCover", "humidity", "visibility", "dewPoint", "precipitation", "uvIndex"] as const;
    for (const field of fields) {
      for (const invalid of [NaN, Infinity, -Infinity, "7"]) {
        const result = computeAtmosphere({ [field]: invalid } as WeatherVisualInput);
        expect(result.inputStatus[field]).toBe("invalid");
        expect(result.atmosphere).toEqual(state({}));
      }
    }
    const result = computeAtmosphere({ light: 9, cloudCover: 105, humidity: -5, visibility: -1, precipitation: -1, uvIndex: -2 });
    for (const field of ["light", "cloudCover", "humidity", "visibility", "precipitation", "uvIndex"] as const) {
      expect(result.inputStatus[field]).toBe("clamped");
    }
    expect(result.atmosphere.cloudiness).toBe(1);
    expect(result.atmosphere.wetness).toBe(0);
    expect(result.atmosphere.haze).toBeCloseTo(0.65);
  });

  it("stays deterministic and immutable without reading place, time, wind or WeatherState", () => {
    const input = { light: 0.5, temp: 25, humidity: 80, visibility: 2, precipitation: 1 };
    const expected = computeAtmosphere(input);
    expect(computeAtmosphere(Object.fromEntries(Object.entries(input).reverse()))).toEqual(expected);
    const extended = { ...input, city: "Milan", time: Date.now(), windSpeed: 150, windGust: 250, state: "STORM" };
    expect(computeAtmosphere(extended)).toEqual(expected);
    input.temp = -20;
    expect(expected.atmosphere.warmth).toBeGreaterThan(0);
    expect(Object.isFrozen(expected)).toBe(true);
    expect(Object.isFrozen(expected.inputStatus)).toBe(true);
  });
});
