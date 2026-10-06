import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTimeline } from "@/lib/weather/frames";
import { fingerprintKey, fingerprintOf } from "@/lib/weather/fingerprint";
import { frameLook } from "@/lib/weather/look";
import { createMockProvider } from "@/lib/api/providers/mock";
import { getRecordComposition } from "@/lib/record/compose";
import { metricsFor } from "@/lib/record/metrics";
import type { Measure } from "@/lib/record/types";
import { posterSnapshot, recordClock, recordInputOf } from "./usePosterSnapshot";

const NOW = Date.parse("2026-10-04T10:00:00Z") / 1000;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW * 1000);
});
afterEach(() => vi.useRealTimers());

const view = { zoom: 12, pitch: 30, bearing: 45 };

async function sources(scenario: "clear" | "heavy-rain" = "clear") {
  const data = await createMockProvider(scenario, "12:00").getByCoords(45.46, 9.19);
  const timeline = buildTimeline(data);
  return { data, timeline };
}

describe("the poster's snapshot", () => {
  it("takes the moment on show: its time, the place's zone, its fingerprint and its temperature", async () => {
    const { data, timeline } = await sources("heavy-rain");
    const frame = timeline.frames[3];
    const look = frameLook(frame);
    const snap = posterSnapshot({ place: data.place, frame, look, timeZone: data.timezone, palette: look.palette, options: ["water"], view });
    expect(snap).toMatchObject({ time: frame.time, timeZone: data.timezone, allDay: false, temp: frame.temp, view, palette: look.palette });
    expect(fingerprintKey(snap.fingerprint)).toBe(
      fingerprintKey(fingerprintOf({ atmosphere: look.atmosphere, inputStatus: look.atmosphereInputStatus }, frame.light)),
    );
    expect(snap.place).toMatchObject({ name: data.place.name, lat: data.place.lat, lon: data.place.lon });
  });

  it("marks a day's stand-in frame as a whole day", async () => {
    const { data, timeline } = await sources();
    const frame = timeline.days[timeline.days.length - 1].overview;
    const look = frameLook(frame);
    expect(posterSnapshot({ place: data.place, frame, look, timeZone: data.timezone, palette: look.palette, options: [], view }).allDay).toBe(true);
  });

  it("gives the record a day's stand-in as a whole day: the date alone, the day's range, no filler readings", async () => {
    const { data, timeline } = await sources("heavy-rain");
    const last = timeline.days[timeline.days.length - 1];
    const frame = last.overview;
    const day = timeline.days.find((d) => d.key === frame.dayKey)!;
    const r = recordInputOf({ place: data.place, frame, timeZone: data.timezone, day: { high: day.high, low: day.low } });
    expect(r).toMatchObject({ allDay: true, date: frame.dayKey, temp: frame.temp, high: day.high, low: day.low });
    for (const k of ["feelsLike", "windSpeed", "cloudCover", "precipitation"] as const) expect(r[k], k).toBeUndefined();
    const measure: Measure = (text, f) => text.length * f.size * 0.6;
    const s = getRecordComposition(r, null, measure, undefined, "raster");
    const all = s.layers.flatMap((l) => (l.payload.kind === "text" ? l.payload.lines.map((x) => x.text) : [])).join(" | ");
    expect(all).toContain("ALL DAY");
    expect(all).toContain("HIGH / LOW");
    expect(all).not.toMatch(/\d\d:\d\d|GMT|TEMP|FEELS|WIND|PRECIP|CLOUD/);
  });

  it("prints a whole day without its range as its high alone, and its UV as the day's peak", async () => {
    const { data, timeline } = await sources();
    const frame = timeline.days[timeline.days.length - 1].overview;
    const r = { ...recordInputOf({ place: data.place, frame, timeZone: data.timezone }), uv: 6 };
    const measure: Measure = (text, f) => text.length * f.size * 0.6;
    const all = getRecordComposition(r, null, measure, undefined, "raster")
      .layers.flatMap((l) => (l.payload.kind === "text" ? l.payload.lines.map((x) => x.text) : []));
    expect(all).toContain("HIGH");
    expect(all).not.toContain("TEMP");
    expect(all).not.toContain("HIGH / LOW");
    expect(metricsFor(["uv"], r, 1, [])[0].label).toBe("UV MAX");
  });

  it("gives the record an hour as it is: its clock, its zone and its readings", async () => {
    const { data, timeline } = await sources("heavy-rain");
    const frame = timeline.frames[3];
    const r = recordInputOf({ place: data.place, frame, timeZone: data.timezone });
    expect(r).toMatchObject({ allDay: false, temp: frame.temp, feelsLike: frame.feelsLike, windSpeed: frame.windSpeed, precipitation: frame.precipitation });
    expect(r.high).toBeUndefined();
    expect(r.time).toMatch(/^\d\d:\d\d$/);
  });

  it("tells the record which figures are not plain readings (ADR-006)", async () => {
    const { data, timeline } = await sources();
    const read = timeline.frames.find((f, i) => i > 0 && f.measured)!;
    // The mock gives every hour; an hour between two of a provider's points is one it marks unmeasured
    const between = { ...read, measured: false };
    const input = (frame: typeof read, day?: { high: number; low: number; partial?: boolean }) =>
      recordInputOf({ place: data.place, frame, timeZone: data.timezone, day });
    expect(input(between).provenance).toEqual({ interpolated: true });
    expect(input(read).provenance).toBeUndefined();
    expect(input(read, { high: 20, low: 10, partial: true }).provenance).toEqual({ partialRange: true });
    const estimated = { ...read, atmosphericSources: { humidity: "estimated" as const, visibility: "provider" as const } };
    expect(input(estimated).provenance).toEqual({ estimated: ["humidity"] });
    // A day's stand-in is a whole day, not an interpolated hour
    expect(input(timeline.days[timeline.days.length - 1].overview).provenance).toBeUndefined();
  });

  it("reads the place's clock, half-hour zones included, and falls back to GMT for an unknown zone", () => {
    const ts = Date.parse("2026-10-05T10:00:00Z") / 1000;
    expect(recordClock(ts, "Europe/Rome")).toEqual({ time: "12:00", zone: "GMT+2" });
    expect(recordClock(ts, "Asia/Kolkata")).toEqual({ time: "15:30", zone: "GMT+5:30" });
    expect(recordClock(ts, "Not/AZone")).toEqual({ time: "10:00", zone: "GMT" });
  });

  it("keeps its own copy of the map's layers, so a later change to the viewer's choice does not reach it", async () => {
    const { data, timeline } = await sources();
    const frame = timeline.frames[0];
    const look = frameLook(frame);
    const options = ["water" as const];
    const snap = posterSnapshot({ place: data.place, frame, look, timeZone: data.timezone, palette: look.palette, options, view });
    expect(snap.options).toEqual(options);
    expect(snap.options).not.toBe(options);
  });
});
