import { describe, expect, it, vi } from "vitest";
import type { AtlasHour, AtlasPoint, PointSky } from "@/types/atlas";
import { NOW_SELECTION } from "@/lib/weather/instant";
import { dayStep, hourAt, viewOf } from "./hours";
import { createTimeStore } from "./time-store";

const SKY: PointSky = {
  sky1: "#2260af",
  sky2: "#226ca4",
  sky3: "#466f84",
  glass: "rgb(1 13 34 / 0.340)",
  glow: "rgb(249 231 169 / 0.471)",
  sun: "#f9e7a9",
  cloud: "rgb(255 255 255 / 0.200)",
  air: { depth: 1, waterWeight: 1, roadWeight: 1, buildingWeight: 1, terrainWeight: 1, saturation: 1, landLift: 0, waterDeepen: 0 },
};
const H = 3600;
const T0 = 1_792_500_000 - (1_792_500_000 % H);
const hour = (i: number, temp = 10 + i): AtlasHour => ({ time: T0 + i * H, temp, label: "Sereno", condition: "clear", night: false, sky: SKY });
const HOURS = [0, 1, 2, 3, 5, 6].map((i) => hour(i)); // a gap at hour 4

describe("hourAt", () => {
  it("answers an instant with the nearest hour within half an hour, the earlier on a tie", () => {
    expect(hourAt(HOURS, T0 + 2 * H)).toMatchObject({ status: "ok", index: 2 });
    expect(hourAt(HOURS, T0 + 2 * H + 1700)).toMatchObject({ status: "ok", index: 2 });
    expect(hourAt(HOURS, T0 + H / 2)).toMatchObject({ status: "ok", index: 0 });
  });

  it("says why there is no hour, and never gives another one", () => {
    expect(hourAt(HOURS, T0 - 2 * H)).toEqual({ status: "unavailable", reason: "before-start" });
    expect(hourAt(HOURS, T0 + 9 * H)).toEqual({ status: "unavailable", reason: "beyond-horizon" });
    expect(hourAt(HOURS, T0 + 4 * H)).toEqual({ status: "unavailable", reason: "gap" });
    expect(hourAt([], T0)).toEqual({ status: "unavailable", reason: "no-frames" });
    expect(hourAt(HOURS, Number.NaN)).toEqual({ status: "unavailable", reason: "invalid" });
  });
});

describe("viewOf", () => {
  const point: AtlasPoint = {
    cell: { lat: 45.07, lon: 7.69 },
    place: null,
    sky: SKY,
    timezone: "Europe/Rome",
    provider: "mock",
    time: T0 + 600,
    temp: 9.5,
    label: "Poco nuvoloso",
    condition: "partly-cloudy",
    night: false,
    hours: HOURS,
  };

  it("Adesso is the point's own reading, live", () => {
    expect(viewOf(point, NOW_SELECTION)).toEqual({
      status: "ok",
      live: true,
      hour: { time: point.time, temp: 9.5, label: "Poco nuvoloso", condition: "partly-cloudy", night: false, sky: SKY },
    });
  });

  it("an instant is its hour, or unavailable with the instant kept", () => {
    expect(viewOf(point, { mode: "at", instant: T0 + 3 * H })).toEqual({ status: "ok", live: false, hour: HOURS[3] });
    expect(viewOf(point, { mode: "at", instant: T0 + 20 * H })).toEqual({ status: "unavailable", reason: "beyond-horizon", requested: T0 + 20 * H });
  });
});

describe("createTimeStore", () => {
  it("tells its listeners of a new moment, and of nothing when the moment is the same", () => {
    const store = createTimeStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ mode: "now" });
    expect(listener).not.toHaveBeenCalled();
    store.set({ mode: "at", instant: T0 });
    store.set({ mode: "at", instant: T0 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get()).toEqual({ mode: "at", instant: T0 });
    store.set({ mode: "now" });
    expect(store.get()).toBe(NOW_SELECTION);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("stops telling a listener that left", () => {
    const store = createTimeStore({ mode: "at", instant: T0 });
    const listener = vi.fn();
    const leave = store.subscribe(listener);
    leave();
    store.set(NOW_SELECTION);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("dayStep (the time bar's Page Up and Page Down)", () => {
  // Rome, Sunday 25 October 2026: clocks go back at 03:00, a 25-hour day
  const start = Date.UTC(2026, 9, 24, 13) / 1000; // Saturday 24, 15:00 in Rome
  const times = Array.from({ length: 96 }, (_, i) => start + i * 3600);
  const rome = (t: number) => new Intl.DateTimeFormat("en-GB", { weekday: "short", hour: "2-digit", hourCycle: "h23", timeZone: "Europe/Rome" }).format(t * 1000).replace(",", "");

  it("lands on the same hour of the next and previous calendar day across the change of the clocks", () => {
    expect(rome(times[0])).toBe("Sat 15");
    const sunday = dayStep(times, 0, 1, "Europe/Rome");
    expect(rome(times[sunday])).toBe("Sun 15");
    expect(sunday).toBe(25);
    const monday = dayStep(times, sunday, 1, "Europe/Rome");
    expect(rome(times[monday])).toBe("Mon 15");
    expect(dayStep(times, monday, -1, "Europe/Rome")).toBe(sunday);
  });

  it("23:00 on the 25-hour day goes to 23:00 on Monday, not to 22:00 the same day", () => {
    const late = times.findIndex((t) => rome(t) === "Sun 23");
    expect(rome(times[dayStep(times, late, 1, "Europe/Rome")])).toBe("Mon 23");
  });
});
