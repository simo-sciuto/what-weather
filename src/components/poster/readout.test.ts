import { describe, expect, it } from "vitest";
import { fingerprintOf, parseFingerprint } from "@/lib/weather/fingerprint";
import { computeAtmosphere } from "@/lib/weather/visual-input";
import { daylightOf, readoutRows, readoutStamp } from "./readout";

const fp = (key: string) => parseFingerprint(key)!;

describe("the poster's readout (WTH-183)", () => {
  it("has the same eight rows in the same order on every poster, whatever the weather", () => {
    const labels = ["Light", "Warmth", "Cloud", "Haze", "Wet", "Snow", "Storm", "Energy"];
    expect(readoutRows(fp("wf1/p50/w30/c80/h20/r40/s0/v10/e60~tchvdpu")).map((r) => r.label)).toEqual(labels);
    expect(readoutRows(fp("wf1/p-50/w-90/c0/h0/r0/s70/v0/e0~")).map((r) => r.label)).toEqual(labels);
  });

  it("takes the fingerprint's hundredths to bars, warmth alone from the middle", () => {
    const rows = readoutRows(fp("wf1/p50/w-40/c80/h20/r40/s5/v10/e60~tchvdpu"));
    const by = Object.fromEntries(rows.map((r) => [r.label, r]));
    expect(by.Warmth).toMatchObject({ value: -0.4, centred: true });
    expect(by.Cloud).toMatchObject({ value: 0.8, centred: false });
    expect(by.Haze.value).toBe(0.2);
    expect(by.Wet.value).toBe(0.4);
    expect(by.Snow.value).toBe(0.05);
    expect(by.Storm.value).toBe(0.1);
    expect(by.Energy.value).toBe(0.6);
    expect(rows.filter((r) => r.centred).map((r) => r.label)).toEqual(["Warmth"]);
  });

  it("draws light as the daylight of the phase: full at midday, none at night, the same at dawn and dusk", () => {
    expect(daylightOf(50)).toBe(1);
    expect(daylightOf(-50)).toBe(0);
    expect(daylightOf(150)).toBe(0);
    expect(daylightOf(0)).toBe(0);
    expect(daylightOf(5)).toBeCloseTo(daylightOf(95), 12);
    expect(daylightOf(5)).toBeGreaterThan(0);
  });

  it("marks as estimated every axis whose measurement is missing, and only those", () => {
    const full = readoutRows(fp("wf1/p50/w30/c80/h20/r40/s0/v10/e60~tchvdpu"));
    expect(full.some((r) => r.estimated)).toBe(false);
    const bare = Object.fromEntries(readoutRows(fp("wf1/p50/w0/c80/h0/r40/s0/v10/e60~")).map((r) => [r.label, r.estimated]));
    expect(bare).toEqual({ Light: false, Warmth: true, Cloud: true, Haze: true, Wet: true, Snow: true, Storm: true, Energy: true });
    // Humidity and dew point alone do not make haze measured: visibility leads it
    expect(readoutRows(fp("wf1/p50/w30/c80/h20/r40/s0/v10/e60~tchdpu")).find((r) => r.label === "Haze")!.estimated).toBe(true);
  });

  it("never calls night's zero energy an estimate, UV or no UV", () => {
    const night = readoutRows(fp("wf1/p150/w10/c20/h0/r0/s0/v0/e0~tchvdp"));
    expect(night.find((r) => r.label === "Energy")).toMatchObject({ value: 0, estimated: false });
    const day = readoutRows(fp("wf1/p50/w10/c20/h0/r0/s0/v0/e50~tchvdp"));
    expect(day.find((r) => r.label === "Energy")!.estimated).toBe(true);
  });

  it("reads a fingerprint made from measurements end to end", () => {
    const visual = computeAtmosphere({ light: 0.5, temp: 24, cloudCover: 30, humidity: 50, visibility: 20, dewPoint: 10, precipitation: 0, uvIndex: 6 });
    const rows = readoutRows(fingerprintOf(visual, 0.5));
    expect(rows.some((r) => r.estimated)).toBe(false);
    expect(rows.every((r) => r.value >= (r.centred ? -1 : 0) && r.value <= 1)).toBe(true);
  });
});

describe("the readout's stamp", () => {
  // 2026-10-03 16:42 UTC
  const ts = Date.UTC(2026, 9, 3, 16, 42) / 1000;

  it("gives the place's own date, hour and zone", () => {
    expect(readoutStamp(ts, "Europe/Rome")).toBe("03.10.2026 · 18:42 CEST");
    expect(readoutStamp(ts, "UTC")).toBe("03.10.2026 · 16:42 UTC");
  });

  it("turns the date over with the place's clock, not the viewer's", () => {
    expect(readoutStamp(ts, "Asia/Tokyo")).toBe("04.10.2026 · 01:42 GMT+9");
  });
});
