import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTimeline } from "@/lib/weather/frames";
import { fingerprintKey, fingerprintOf } from "@/lib/weather/fingerprint";
import { frameLook } from "@/lib/weather/look";
import { createMockProvider } from "@/lib/api/providers/mock";
import { posterSnapshot } from "./usePosterSnapshot";

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
