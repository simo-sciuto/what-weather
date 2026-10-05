import { describe, expect, it } from "vitest";
import { clamp, clamp01, lerp, mod, smoothstep, toDegrees, toRadians } from "./math";

describe("math utils", () => {
  it("clamps between two limits, and between 0 and 1", () => {
    expect([clamp(5, 0, 3), clamp(-2, 0, 3), clamp(2, 0, 3)]).toEqual([3, 0, 2]);
    expect([clamp01(1.4), clamp01(-0.2), clamp01(0.25)]).toEqual([1, 0, 0.25]);
  });

  it("interpolates without holding the fraction to 0..1", () => {
    expect([lerp(10, 20, 0), lerp(10, 20, 1), lerp(10, 20, 0.25), lerp(10, 20, 2)]).toEqual([10, 20, 12.5, 30]);
  });

  it("smoothsteps: 0 below, 1 above, 0.5 in the middle, flat at both ends", () => {
    expect([smoothstep(2, 6, 0), smoothstep(2, 6, 9), smoothstep(2, 6, 4)]).toEqual([0, 1, 0.5]);
    expect(smoothstep(0, 1, 0.01)).toBeLessThan(0.001);
    expect(smoothstep(0, 1, 0.99)).toBeGreaterThan(0.999);
    // The same S as the formula, and rising
    const t = 0.3;
    expect(smoothstep(0, 1, t)).toBeCloseTo(t * t * (3 - 2 * t), 12);
    expect(smoothstep(0, 1, 0.6)).toBeGreaterThan(smoothstep(0, 1, 0.5));
  });

  it("takes a remainder with the sign of the divisor", () => {
    expect([mod(370, 360), mod(-90, 360), mod(0, 360), mod(360, 360)]).toEqual([10, 270, 0, 0]);
  });

  it("converts between degrees and radians, both ways", () => {
    expect(toRadians(180)).toBeCloseTo(Math.PI, 12);
    expect(toRadians(90)).toBeCloseTo(Math.PI / 2, 12);
    expect(toDegrees(Math.PI)).toBeCloseTo(180, 12);
    expect(toDegrees(toRadians(37.5))).toBeCloseTo(37.5, 12);
  });
});
