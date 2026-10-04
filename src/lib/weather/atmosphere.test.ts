import { describe, expect, it } from "vitest";
import { createAtmosphere, HAZE_ONSET, type AtmosphereAxes } from "./atmosphere";

const clearNight: AtmosphereAxes = {
  daylight: 0, warmth: 0, cloudiness: 0, haze: 0,
  wetness: 0, severity: 0, snow: 0, energy: 0,
};
const atmosphere = (axes: Partial<AtmosphereAxes> = {}) => createAtmosphere({ ...clearNight, ...axes });

describe("normalized atmosphere grammar", () => {
  it("does not invent sun or a secondary force in a neutral clear night", () => {
    expect(atmosphere().signature).toEqual({ dominant: null, secondary: null });
    expect(atmosphere({ daylight: 1 }).signature).toEqual({ dominant: "sun", secondary: null });
  });

  it("distinguishes fog from thunderstorm at the same 90% cloud influence", () => {
    const common = { daylight: 0.5, cloudiness: 0.9 };
    expect(atmosphere({ ...common, haze: 1 }).signature).toEqual({ dominant: "haze", secondary: "cloud" });
    // Cloud is background (weight 0.6): the rain under the storm is ahead of the overcast
    expect(atmosphere({ ...common, severity: 1, wetness: 0.7 }).signature).toEqual({ dominant: "storm", secondary: "rain" });
  });

  it("counts haze as a force only once it acts: below the onset it is no force, from there it grows (WTH-046K)", () => {
    expect(atmosphere({ haze: 0.3 }).signature).toEqual({ dominant: null, secondary: null });
    expect(atmosphere({ haze: HAZE_ONSET }).signature.dominant).toBeNull();
    expect(atmosphere({ haze: 0.3, wetness: 0.2 }).signature).toEqual({ dominant: "rain", secondary: null });
    expect(atmosphere({ haze: 0.8, wetness: 0.2 }).signature).toEqual({ dominant: "haze", secondary: "rain" });
  });

  it("ranks precipitation ahead of a full overcast, and clouds ahead of a faint one (WTH-046K)", () => {
    expect(atmosphere({ cloudiness: 1, wetness: 0.8 }).signature).toEqual({ dominant: "rain", secondary: "cloud" });
    expect(atmosphere({ cloudiness: 1, snow: 0.7 }).signature).toEqual({ dominant: "snow", secondary: "cloud" });
    expect(atmosphere({ cloudiness: 1, wetness: 0.5 }).signature).toEqual({ dominant: "cloud", secondary: "rain" });
    expect(atmosphere({ cloudiness: 1, wetness: 0.1 }).signature.dominant).toBe("cloud");
  });

  it("keeps snow and rain distinct, including mixed precipitation", () => {
    expect(atmosphere({ snow: 0.8 }).signature.dominant).toBe("snow");
    expect(atmosphere({ wetness: 0.8 }).signature.dominant).toBe("rain");
    expect(atmosphere({ snow: 0.8, wetness: 0.8 }).signature).toEqual({ dominant: "snow", secondary: "rain" });
  });

  it("uses intensity before precedence and explicit precedence for exact ties", () => {
    expect(atmosphere({ severity: 0.2, haze: 0.9 }).signature).toEqual({ dominant: "haze", secondary: "storm" });
    expect(atmosphere({ severity: 1, snow: 1, wetness: 1, haze: 1, cloudiness: 1 }).signature)
      .toEqual({ dominant: "storm", secondary: "snow" });
    expect(atmosphere({ wetness: 1, haze: 1, cloudiness: 1 }).signature)
      .toEqual({ dominant: "rain", secondary: "haze" });
    // Exact ties by precedence: haze, then cold, both ahead of the weighted cloud
    expect(atmosphere({ haze: 1, cloudiness: 1, warmth: -1 }).signature)
      .toEqual({ dominant: "haze", secondary: "cold" });
    expect(atmosphere({ daylight: 0.5, warmth: 0.5 }).signature)
      .toEqual({ dominant: "heat", secondary: "sun" });
    expect(atmosphere({ daylight: 0.5, warmth: -0.5 }).signature)
      .toEqual({ dominant: "cold", secondary: "sun" });
  });

  it("suppresses sun under overcast or opaque haze without erasing available light", () => {
    for (const obstruction of [{ cloudiness: 1 }, { haze: 1 }]) {
      const state = atmosphere({ daylight: 1, ...obstruction });
      expect(state.daylight).toBe(1);
      expect([state.signature.dominant, state.signature.secondary]).not.toContain("sun");
    }
  });

  it("keeps clarity complementary to haze, not cloudiness", () => {
    let previous = 1;
    for (const haze of [0, 0.1, 0.3, 0.7, 1]) {
      const state = atmosphere({ haze, cloudiness: 1 });
      expect(state.clarity).toBeLessThanOrEqual(previous);
      expect(state.clarity + state.haze).toBeCloseTo(1);
      previous = state.clarity;
    }
  });

  it("is reproducible across property order and does not retain mutable input", () => {
    const input = { ...clearNight, daylight: 0.8, warmth: 0.6, energy: 0.4 };
    const state = createAtmosphere(input);
    const reordered = Object.fromEntries(Object.entries(input).reverse()) as unknown as AtmosphereAxes;
    expect(createAtmosphere(reordered)).toEqual(state);
    input.warmth = -1;
    expect(state.warmth).toBe(0.6);
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.signature)).toBe(true);
  });

  it("keeps solar energy separate from thermal warmth and force ranking", () => {
    const lowUV = atmosphere({ daylight: 1, warmth: -0.6, energy: 0 });
    const highUV = atmosphere({ daylight: 1, warmth: -0.6, energy: 1 });
    expect(lowUV.signature).toEqual(highUV.signature);
    expect(highUV.warmth).toBe(-0.6);
    expect(highUV.energy).toBe(1);
  });

  it("rejects nonfinite, missing and out-of-range internal axes", () => {
    for (const axis of Object.keys(clearNight) as (keyof AtmosphereAxes)[]) {
      for (const invalid of [NaN, Infinity, -Infinity, undefined, null, "0", 1.01, axis === "warmth" ? -1.01 : -0.01]) {
        expect(() => createAtmosphere({ ...clearNight, [axis]: invalid } as AtmosphereAxes), `${axis}=${invalid}`)
          .toThrow(RangeError);
      }
    }
  });

  it("requires daylight-gated energy and accepts warmth endpoints", () => {
    expect(() => atmosphere({ energy: 0.01 })).toThrow("energy must not exceed daylight");
    expect(() => atmosphere({ daylight: 0.4, energy: 0.5 })).toThrow(RangeError);
    expect(atmosphere({ warmth: -1 }).signature.dominant).toBe("cold");
    expect(atmosphere({ warmth: 1 }).signature.dominant).toBe("heat");
    expect(atmosphere({ daylight: 0.4, energy: 0.4 }).energy).toBe(0.4);
  });
});
