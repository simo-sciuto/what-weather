import { describe, expect, it } from "vitest";
import { dayWord, shareText } from "./share-text";

/* WTH-278: the words of a shared poster say which moment it is of. */

const ZONE = "Europe/Rome";
// Saturday 2026-10-24, 15:00 in Roma (13:00 UTC)
const NOW = Date.UTC(2026, 9, 24, 13, 0) / 1000;
const at = (offsetHours: number) => NOW + offsetHours * 3600;

describe("the day of a moment", () => {
  it("is oggi, domani and ieri on the place's clock, and the weekday and date beyond them", () => {
    expect(dayWord(NOW, NOW, ZONE)).toBe("oggi");
    expect(dayWord(at(24), NOW, ZONE)).toBe("domani");
    expect(dayWord(at(-24), NOW, ZONE)).toBe("ieri");
    expect(dayWord(at(72), NOW, ZONE)).toBe("martedì 27 ottobre");
  });

  it("follows the place's own clock, not the viewer's: late evening in Roma is already tomorrow in Tokyo", () => {
    const lateRoma = Date.UTC(2026, 9, 24, 21, 0) / 1000;
    expect(dayWord(lateRoma, lateRoma, "Europe/Rome")).toBe("oggi");
    expect(dayWord(lateRoma + 3 * 3600, lateRoma, "Europe/Rome")).toBe("domani");
    expect(dayWord(lateRoma, lateRoma, "Asia/Tokyo")).toBe("oggi");
  });

  it("does not throw on a zone Intl does not know", () => {
    expect(typeof dayWord(NOW, NOW, "Nowhere/Land")).toBe("string");
  });
});

describe("the words of a shared poster", () => {
  const hour = (time: number, extra = {}) => ({ time, timeZone: ZONE, allDay: false, ...extra });

  it("says adesso only for the current conditions, within half an hour of the clock", () => {
    expect(shareText("Torino", hour(NOW), NOW)).toBe("Torino, il cielo di adesso in un poster. Il meteo è qui:");
    expect(shareText("Torino", hour(NOW + 29 * 60), NOW)).toContain("adesso");
    expect(shareText("Torino", hour(NOW - 29 * 60), NOW)).toContain("adesso");
  });

  it("names the day and the hour of a later moment on the place's clock, and says it is a forecast", () => {
    // 24 hours later is 14:00 on the clock: the summer time ends that night (2026-10-25), and the words follow the place's clock
    expect(shareText("Torino", hour(at(24), { forecast: true }), NOW)).toBe("Torino, il cielo previsto per domani alle 14:00 in un poster. Il meteo è qui:");
    expect(shareText("Torino", hour(at(3), { forecast: true }), NOW)).toBe("Torino, il cielo previsto per oggi alle 18:00 in un poster. Il meteo è qui:");
  });

  it("is not adesso when the hour is a forecast, even a close one", () => {
    expect(shareText("Torino", hour(NOW, { forecast: true }), NOW)).not.toContain("adesso");
  });

  it("names the day and the hour of an earlier moment, without calling it a forecast", () => {
    expect(shareText("Torino", hour(at(-6)), NOW)).toBe("Torino, il cielo di oggi alle 09:00 in un poster. Il meteo è qui:");
    expect(shareText("Torino", hour(at(-30)), NOW)).toContain("il cielo di ieri alle");
  });

  it("names the day of a whole-day poster, with no hour", () => {
    expect(shareText("Torino", { time: at(24), timeZone: ZONE, allDay: true }, NOW)).toBe("Torino, il cielo di domani in un poster. Il meteo è qui:");
    expect(shareText("Torino", { time: NOW, timeZone: ZONE, allDay: true }, NOW)).toBe("Torino, il cielo di oggi in un poster. Il meteo è qui:");
  });

  it("keeps the place's name as it is", () => {
    expect(shareText("L'Aquila", hour(NOW), NOW).startsWith("L'Aquila, ")).toBe(true);
  });
});
