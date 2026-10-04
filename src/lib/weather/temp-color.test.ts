import { describe, expect, it } from "vitest";
import { scaleChroma } from "./palette";
import { tempAccent, tempColor, tempGradient } from "./temp-color";

/* OKLCH, written out here so the tests do not lean on the code they check. */
const lin = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const channels = (css: string) => css.match(/\d+/g)!.map(Number);
function oklch(c: number[]): [number, number, number] {
  const [r, g, b] = c.map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)];
}
const hueGap = (a: number, b: number) => Math.abs((((a - b + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
const TEMPS = Array.from({ length: 56 }, (_, i) => -15 + i);

describe("temperature colour (WTH-046I)", () => {
  it("keeps the absolute scale as it was: the anchors and a few steps between, so figures stay comparable", () => {
    expect(tempColor(-10)).toBe("rgb(211 190 250)");
    expect(tempColor(0)).toBe("rgb(191 203 254)");
    expect(tempColor(23)).toBe("rgb(249 232 167)");
    expect(tempColor(36)).toBe("rgb(254 184 193)");
    expect(tempColor(-30)).toBe(tempColor(-10));
    expect(tempColor(50)).toBe(tempColor(36));
    // Half way between 10 and 17 degrees: (156+165)/2, (224+233)/2, (247+202)/2, rounded half up
    expect(tempColor(13.5)).toBe("rgb(161 229 225)");
    expect(tempGradient(5, 25).startsWith("linear-gradient(90deg, ")).toBe(true);
  });

  it("is exactly the scale at saturation 1: the accent changes nothing until the weather asks", () => {
    for (const t of TEMPS) expect(tempAccent(t, 1)).toBe(tempColor(t));
  });

  it("falls back to the scale when there is no number to follow", () => {
    for (const bad of [NaN, Infinity, -Infinity, undefined as unknown as number]) expect(tempAccent(20, bad)).toBe(tempColor(20));
  });

  it("keeps lightness and hue and moves only chroma, in the direction of the saturation", () => {
    for (const t of TEMPS)
      for (const k of [0.55, 0.65, 0.85, 1.1]) {
        const [base, acc] = [oklch(channels(tempColor(t))), oklch(channels(tempAccent(t, k)))];
        expect(Math.abs(base[0] - acc[0]), `lightness at ${t} x${k}`).toBeLessThan(0.03);
        // A pale pastel has little chroma: its hue moves a little more than a vivid one's, never past 15 degrees
        expect(hueGap(base[2], acc[2]), `hue at ${t} x${k}`).toBeLessThan((15 * Math.PI) / 180);
        if (k < 1) expect(acc[1], `chroma at ${t} x${k}`).toBeLessThan(base[1] + 0.004);
        else expect(acc[1], `chroma at ${t} x${k}`).toBeGreaterThanOrEqual(base[1] - 0.004);
      }
  });

  it("is never more vivid as the saturation falls, step after step", () => {
    for (const t of TEMPS) {
      const chromas = [1.1, 1, 0.85, 0.7, 0.55].map((k) => oklch(channels(tempAccent(t, k)))[1]);
      chromas.slice(1).forEach((c, i) => expect(c, `at ${t}`).toBeLessThanOrEqual(chromas[i] + 0.004));
    }
  });

  it("tells every temperature apart by hue even in the quietest weather, so the accent still reads as temperature", () => {
    // Snow's saturation (0.55 at the floor): the scale's order, cold to hot, is still seen in the hue
    const cold = oklch(channels(tempAccent(-5, 0.55)));
    const mild = oklch(channels(tempAccent(18, 0.55)));
    const hot = oklch(channels(tempAccent(34, 0.55)));
    expect(hueGap(cold[2], hot[2])).toBeGreaterThan((60 * Math.PI) / 180);
    expect(hueGap(mild[2], hot[2])).toBeGreaterThan((20 * Math.PI) / 180);
  });

  it("scales chroma to the gamut's edge without leaving sRGB or inventing a hue", () => {
    for (const t of TEMPS) {
      const out = scaleChroma(channels(tempColor(t)) as [number, number, number], 1.15);
      out.forEach((v) => {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(255);
      });
    }
    expect(scaleChroma([128, 128, 128], 1.1)).toEqual([128, 128, 128]);
  });
});
