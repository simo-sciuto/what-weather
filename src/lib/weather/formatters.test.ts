import { describe, expect, it } from "vitest";
import { conditionLabel, formatTime, localDay, localDayBounds, placeSubtitle, spokenTime, tempDigits, type Preposition } from "./formatters";
import { regionName } from "./regions";
import { offsetToZone } from "@/lib/api/providers/openweather-transformers";

const TZ = "Europe/Rome";
/** A moment on 28 September 2026 in Rome (UTC+2 in summer time). */
const at = (h: number, m = 0) => Date.UTC(2026, 8, 28, h - 2, m) / 1000;

describe("spokenTime", () => {
  it.each<[number, number, Preposition, string]>([
    [17, 0, "verso le", "verso le 17"],
    [9, 30, "alle", "alle 9:30"],
    [14, 0, "tra le", "tra le 14"],
    [18, 0, "e le", "e le 18"],
    // "l’una", elided, never "le 1"
    [1, 0, "alle", "all’una"],
    [1, 0, "verso le", "verso l’una"],
    [1, 15, "fino alle", "fino all’1:15"],
    // Midnight and noon by name, with the bare preposition
    [0, 0, "dalle", "da mezzanotte"],
    [0, 0, "fino alle", "fino a mezzanotte"],
    [12, 0, "verso le", "verso mezzogiorno"],
  ])("%i:%i with “%s” → %s", (h, m, prep, expected) => {
    expect(spokenTime(at(h, m), TZ, prep)).toBe(expected);
  });
});

describe("conditionLabel", () => {
  it("scales precipitation with feminine adjectives", () => {
    expect(conditionLabel({ condition: "rain", intensity: "light" })).toBe("Pioggia debole");
    expect(conditionLabel({ condition: "snow", intensity: "heavy" })).toBe("Neve forte");
    expect(conditionLabel({ condition: "drizzle", intensity: "moderate" })).toBe("Pioviggine");
  });
  it("tells overcast from cloudy by cover", () => {
    expect(conditionLabel({ condition: "cloudy", intensity: "moderate", cloudCover: 95 })).toBe("Coperto");
    expect(conditionLabel({ condition: "cloudy", intensity: "moderate", cloudCover: 70 })).toBe("Nuvoloso");
  });
});

describe("tempDigits", () => {
  it("never shows a negative zero, and uses a real minus sign", () => {
    expect(tempDigits(-0.3)).toBe("0");
    expect(tempDigits(-3.6)).toBe("−4");
    expect(tempDigits(21.5)).toBe("22");
  });
});

describe("places in Italian", () => {
  it("translates regions, including ones saved earlier in English", () => {
    expect(regionName("Lombardy")).toBe("Lombardia");
    expect(regionName("Aosta Valley")).toBe("Valle d’Aosta");
    expect(regionName("Bavaria")).toBe("Baviera");
    expect(regionName("Somewhere Else")).toBe("Somewhere Else");
    expect(placeSubtitle({ name: "Milano", region: "Lombardy", country: "IT", lat: 45.46, lon: 9.19 })).toBe(
      "Lombardia, Italia",
    );
  });
});

describe("offsetToZone", () => {
  it("gives whole hours as IANA names that every Node accepts", () => {
    expect(offsetToZone(7200)).toBe("Etc/GMT-2");
    expect(offsetToZone(-18000)).toBe("Etc/GMT+5");
    expect(offsetToZone(0)).toBe("UTC");
    expect(() => new Intl.DateTimeFormat("it-IT", { timeZone: offsetToZone(7200) })).not.toThrow();
  });
  it("keeps half hours as an offset", () => {
    expect(offsetToZone(19800)).toBe("+05:30");
  });
});

describe("localDayBounds (WTH-003)", () => {
  const at = (iso: string) => Date.parse(iso) / 1000;
  const hours = ([a, b]: [number, number]) => (b - a) / 3600;

  it("is 24 hours for an ordinary day, and its start reads midnight on the clock of the place", () => {
    const [start, end] = localDayBounds(at("2026-07-15T10:00:00Z"), "Europe/Rome");
    expect(hours([start, end])).toBe(24);
    expect(formatTime(start, "Europe/Rome")).toBe("00:00");
    expect(localDay(start, "Europe/Rome")).toBe("2026-07-15");
    expect(localDay(start - 1, "Europe/Rome")).toBe("2026-07-14");
    expect(localDay(end, "Europe/Rome")).toBe("2026-07-16");
  });

  it("is 23 hours the day the clocks go forward and 25 the day they go back, in any hemisphere", () => {
    for (const [tz, day, length] of [
      ["Europe/Rome", "2026-03-29T12:00:00Z", 23],
      ["Europe/Rome", "2026-10-25T12:00:00Z", 25],
      ["America/Denver", "2026-03-08T18:00:00Z", 23],
      ["America/New_York", "2026-11-01T18:00:00Z", 25],
      ["Australia/Sydney", "2026-10-04T05:00:00Z", 23],
      ["Australia/Sydney", "2026-04-05T05:00:00Z", 25],
    ] as const) expect(hours(localDayBounds(at(day), tz)), `${tz} ${day}`).toBe(length);
  });

  it("is half an hour off in the zone that changes by half an hour, and whole days elsewhere in it", () => {
    expect(hours(localDayBounds(at("2026-10-04T12:00:00Z"), "Australia/Lord_Howe"))).toBe(23.5);
    expect(hours(localDayBounds(at("2026-04-05T12:00:00Z"), "Australia/Lord_Howe"))).toBe(24.5);
    expect(hours(localDayBounds(at("2026-07-01T12:00:00Z"), "Asia/Kolkata"))).toBe(24);
  });

  it("holds the day whole where the clocks change at midnight itself: the repeated midnight does not shorten the day before", () => {
    // Azores: at 01:00 UTC on 25 October the clocks go back to 00:00, so the midnight comes twice; 24 October ends at the first
    const [start, end] = localDayBounds(at("2026-10-24T12:00:00Z"), "Atlantic/Azores");
    expect(start).toBe(at("2026-10-24T00:00:00Z"));
    expect(end).toBe(at("2026-10-25T00:00:00Z"));
  });

  it("makes days that follow each other: one's end is the next one's start, for every day of a year, in zones with and without changes", () => {
    for (const tz of ["Europe/Rome", "America/Denver", "Atlantic/Azores", "Australia/Lord_Howe", "Asia/Kolkata", "UTC", "America/Havana"]) {
      let t = at("2026-01-01T12:00:00Z");
      let [, end] = localDayBounds(t, tz);
      for (let d = 0; d < 365; d++) {
        t = end + 12 * 3600;
        const [nextStart, nextEnd] = localDayBounds(t, tz);
        expect(nextStart, `${tz} day ${d}`).toBe(end);
        end = nextEnd;
      }
    }
  });
});
