import { describe, expect, it } from "vitest";
import { fieldColor, type FieldSample } from "./field-color";

/* WTH-272: the colour of a place in the weather field, with the real atmosphere engine. */

const DAY: FieldSample = { temp: 15, cloudCover: 5, precipitation: 0, condition: "clear", intensity: "moderate", light: 0.5 };
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luma = (hex: string) => 0.2126 * rgb(hex)[0] + 0.7152 * rgb(hex)[1] + 0.0722 * rgb(hex)[2];
const dist = (a: string, b: string) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
/** How far toward red a colour leans over blue */
const warmth = (hex: string) => rgb(hex)[0] - rgb(hex)[2];

describe("the colour of a place", () => {
  it("is a #rrggbb colour", () => {
    expect(fieldColor(DAY)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("is warm (red over blue) when hot and cool when mild, and each of the three is its own colour", () => {
    const [cold, mild, hot] = [-5, 15, 34].map((temp) => fieldColor({ ...DAY, temp }));
    // the scale runs lilac, aqua, sage, butter, apricot, rose: only the hot end leans red
    expect(warmth(hot)).toBeGreaterThan(warmth(mild));
    expect(warmth(hot)).toBeGreaterThan(warmth(cold));
    expect(dist(cold, mild)).toBeGreaterThan(25);
    expect(dist(mild, hot)).toBeGreaterThan(40);
  });

  it("is two colours for Milano at 12 degrees and Roma at 19, under a partly cloudy sky", () => {
    const milano = fieldColor({ ...DAY, temp: 12, cloudCover: 40, condition: "partly-cloudy" });
    const roma = fieldColor({ ...DAY, temp: 19, cloudCover: 40, condition: "partly-cloudy" });
    expect(dist(milano, roma)).toBeGreaterThan(30);
  });

  it("is greyer under cloud and rain than under a clear sky, at the same temperature", () => {
    const clear = fieldColor(DAY);
    const cloudy = fieldColor({ ...DAY, condition: "cloudy", cloudCover: 95 });
    const rain = fieldColor({ ...DAY, condition: "rain", cloudCover: 100, precipitation: 4, intensity: "heavy" });
    const chroma = (hex: string) => Math.max(...rgb(hex)) - Math.min(...rgb(hex));
    expect(dist(cloudy, clear)).toBeGreaterThan(25);
    expect(chroma(cloudy)).toBeLessThan(chroma(clear));
    expect(chroma(rain)).toBeLessThan(chroma(clear));
    expect(dist(rain, clear)).toBeGreaterThan(25);
  });

  it("is darker at night than by day, and the temperature still shows a little", () => {
    expect(luma(fieldColor({ ...DAY, light: -1 }))).toBeLessThan(luma(fieldColor(DAY)));
    expect(dist(fieldColor({ ...DAY, light: -1, temp: -5 }), fieldColor({ ...DAY, light: -1, temp: 32 }))).toBeGreaterThan(40);
    // by night too, Milano and Roma are two colours
    expect(dist(fieldColor({ ...DAY, light: -1, temp: 12 }), fieldColor({ ...DAY, light: -1, temp: 19 }))).toBeGreaterThan(20);
  });

  it("keeps the weather's lightness: the temperature changes the hue, not how bright the place is", () => {
    const l = [-5, 10, 25, 36].map((temp) => luma(fieldColor({ ...DAY, temp })));
    expect(Math.max(...l) - Math.min(...l)).toBeLessThan(45);
  });

  it("never throws on a reading the engine would refuse", () => {
    for (const bad of [
      { ...DAY, temp: Number.NaN },
      { ...DAY, cloudCover: 250 },
      { ...DAY, cloudCover: -3 },
      { ...DAY, precipitation: -1 },
      { ...DAY, light: Number.NaN },
      { ...DAY, light: 9 },
    ]) expect(fieldColor(bad)).toMatch(/^#[0-9a-f]{6}$/);
  });
});
