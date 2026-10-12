import { describe, expect, it } from "vitest";
import { dateFormat, localDay } from "./formatters";
import { toDailyFromForecast, type OW25ForecastItem } from "@/lib/api/providers/openweather-transformers";

/*
 * WTH-003: which days of a three-hourly forecast are whole. A day is partial when the forecast does not cover it
 * (today, from now; the last day, cut off); it must not be partial because the clocks changed in it.
 */

const weather = [{ id: 800, main: "Clear", description: "clear sky", icon: "01d" }];
const item = (dt: number, temp = 10): OW25ForecastItem =>
  ({
    dt,
    main: { temp, feels_like: temp, temp_min: temp, temp_max: temp, pressure: 1015, humidity: 70 },
    weather,
    wind: { speed: 2, deg: 0 },
    clouds: { all: 10 },
    visibility: 10000,
    pop: 0,
    sys: { pod: "d" },
  }) as OW25ForecastItem;
const grid = (from: string, steps: number) => {
  const start = Date.parse(`${from}T00:00:00Z`) / 1000;
  return Array.from({ length: steps }, (_, i) => item(start + i * 10800));
};
const ZONES = (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone");

describe("the days a three-hourly forecast covers whole (WTH-003)", () => {
  it("flags no day partial around any change of the clocks in the world's zones: the clocks changing makes no day partial", { timeout: 60_000 }, () => {
    // For every zone, the days where its offset from UTC changes in 2026, found by comparing noon to noon; then five days
    // of forecast round each, with the days between the first and the last (which the ends of the forecast cut) checked.
    // Whole years of forecast in every zone took 80 s under load and held vitest's worker too long.
    const noon = Date.parse("2026-01-01T12:00:00Z") / 1000;
    const offset = (tz: string, t: number) => {
      const p = dateFormat("en-GB", { timeZone: tz, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date(t * 1000));
      const get = (k: string) => Number(p.find((x) => x.type === k)?.value ?? 0);
      return get("hour") * 60 + get("minute");
    };
    const wrong: string[] = [];
    let changes = 0;
    for (const tz of ZONES) {
      let before = offset(tz, noon);
      for (let d = 1; d < 365; d++) {
        const t = noon + d * 86400;
        const now = offset(tz, t);
        if (now !== before) {
          changes++;
          // Forecast steps from two days before the change, on the UTC grid every provider uses
          const from = new Date((t - 3 * 86400) * 1000).toISOString().slice(0, 10);
          toDailyFromForecast(grid(from, 40), tz)
            .slice(1, -1)
            .forEach((day) => day.partial && wrong.push(`${tz} ${localDay(day.time, tz)}`));
        }
        before = now;
      }
    }
    expect(wrong).toEqual([]);
    expect(ZONES.length).toBeGreaterThan(300);
    expect(changes).toBeGreaterThan(200);
  });

  it("flags a day partial when a step is missing in the middle, or the steps are not a whole day's", () => {
    const whole = grid("2026-07-01", 24);
    expect(toDailyFromForecast(whole, "UTC")[1].partial).toBe(false);
    // The day of 2 July with 06:00 and 09:00 gone: it starts and ends in place but is not whole
    const gap = whole.filter((i) => ![Date.parse("2026-07-02T06:00:00Z") / 1000, Date.parse("2026-07-02T09:00:00Z") / 1000].includes(i.dt));
    expect(toDailyFromForecast(gap, "UTC")[1].partial).toBe(true);
  });

  it("keeps the days of the clocks changing, with 23 and 25 hours, whole and in the list", () => {
    // Denver, 8 March 2026 (23 hours, 7 steps: the day the count of 8 dropped); Rome, 29 March and 25 October; New York, 1 November
    for (const [tz, from, day] of [
      ["America/Denver", "2026-03-06", "2026-03-08"],
      ["Europe/Rome", "2026-03-27", "2026-03-29"],
      ["Europe/Rome", "2026-10-23", "2026-10-25"],
      ["America/New_York", "2026-10-30", "2026-11-01"],
      ["Africa/Cairo", "2026-04-22", "2026-04-24"],
      ["Australia/Lord_Howe", "2026-04-03", "2026-04-05"],
    ] as const) {
      const days = toDailyFromForecast(grid(from, 40), tz);
      const found = days.find((d) => localDay(d.time, tz) === day)!;
      expect(found, `${tz} ${day}`).toBeDefined();
      expect(found.partial, `${tz} ${day}`).toBe(false);
    }
  });

  it("still flags the days the forecast does not cover: today from now, and the last day cut short", () => {
    // A forecast from 14:00 local in Rome (12:00Z in summer, +2): today holds the steps 14, 17, 20, 23
    const raw = grid("2026-07-01", 40)
      .filter((i) => i.dt >= Date.parse("2026-07-01T12:00:00Z") / 1000)
      // ...and ending at 11:00 local on the last day: three steps short of a whole one
      .slice(0, -4);
    const days = toDailyFromForecast(raw, "Europe/Rome");
    expect(days[0].partial).toBe(true);
    expect(days.at(-1)!.partial).toBe(true);
    expect(days.slice(1, -1).every((d) => !d.partial)).toBe(true);
    // One step is left of a day: that is partial too, never whole
    expect(toDailyFromForecast(raw.slice(0, 1), "Europe/Rome")[0].partial).toBe(true);
  });

  it("takes a day as whole by where its steps start and end, not how many there are: a place half an hour off the grid too", () => {
    for (const tz of ["Asia/Kolkata", "Asia/Kathmandu", "Pacific/Chatham", "Australia/Adelaide"]) {
      const days = toDailyFromForecast(grid("2026-06-01", 40), tz);
      expect(days.slice(1, -1).every((d) => !d.partial), tz).toBe(true);
    }
  });

  it("works the day's range out from the steps it has, and no wider: the extremes of the slots, as the hourly curve shows them", () => {
    const raw = grid("2026-07-01", 24).map((it, i) => ({ ...it, main: { ...it.main, temp: 10 + (i % 8) } }));
    const day = toDailyFromForecast(raw, "UTC")[1];
    expect(day.min).toBe(10);
    expect(day.max).toBe(17);
  });
});
