import { describe, expect, it } from "vitest";
import { createMockProvider } from "@/lib/api/providers/mock";
import { relabelDays, buildTimeline } from "./frames";
import { localDay } from "./formatters";

const DAY = 86_400;

/** Sample weather read at 23:55 in Rome, and its timeline, built and cached then */
async function cachedAt2355() {
  const data = await createMockProvider("clear", "23:55").getByCoords(45.46, 9.19);
  const timeline = buildTimeline(data);
  return { data, timeline, now: data.current.time };
}

const relativeOf = (t: ReturnType<typeof buildTimeline>, dayKey: string) => t.dayLabels[dayKey]?.relative ?? null;

describe("relabelDays: day names as of the request (WTH-249)", () => {
  it("names today and tomorrow as of the moment of the request", async () => {
    const { data, timeline, now } = await cachedAt2355();
    const today = localDay(now, data.timezone);
    const tomorrow = localDay(now + DAY, data.timezone);
    const fresh = relabelDays(timeline, data.timezone, now);
    expect(relativeOf(fresh, today)).toBe("Oggi");
    expect(relativeOf(fresh, tomorrow)).toBe("Domani");
  });

  it("after midnight, the cached timeline's day names move on with the clock, and its frames stay as they were", async () => {
    const { data, timeline, now } = await cachedAt2355();
    const later = now + 10 * 60; // 00:05 the next day, on the place's clock
    const nextDay = localDay(later, data.timezone);
    const dayAfter = localDay(later + DAY, data.timezone);
    // The frame at 00:30 belongs to the next day: it was "Domani" when cached, and is "Oggi" now
    const frame0030 = timeline.frames.find((f) => f.dayKey === nextDay && localDay(f.time, data.timezone) === nextDay && f.time >= later);
    expect(frame0030).toBeDefined();
    expect(relativeOf(timeline, nextDay)).toBe("Domani");
    const fresh = relabelDays(timeline, data.timezone, later);
    expect(relativeOf(fresh, nextDay)).toBe("Oggi");
    expect(relativeOf(fresh, dayAfter)).toBe("Domani");
    expect(fresh.frames).toBe(timeline.frames);
    expect(fresh.frames.map((f) => f.dayKey)).toEqual(timeline.frames.map((f) => f.dayKey));
  });

  it("flags the day that is today as of the request, and no other", async () => {
    const { data, timeline, now } = await cachedAt2355();
    const later = now + 10 * 60;
    const nextDay = localDay(later, data.timezone);
    const fresh = relabelDays(timeline, data.timezone, later);
    expect(fresh.days.filter((d) => d.isToday).map((d) => d.key)).toEqual(timeline.days.some((d) => d.key === nextDay) ? [nextDay] : []);
  });

  it("does not change the cached timeline: the cache keeps the object it was built with", async () => {
    const { data, timeline, now } = await cachedAt2355();
    const before = JSON.stringify(timeline);
    relabelDays(timeline, data.timezone, now + DAY);
    expect(JSON.stringify(timeline)).toBe(before);
  });

  it("names the days of the place's own zone, whatever zone the cache was built in", async () => {
    const { timeline, now } = await cachedAt2355();
    // Tokyo is seven hours ahead of Rome: at the same instant it is already a later day
    const inTokyo = relabelDays(timeline, "Asia/Tokyo", now);
    expect(relativeOf(inTokyo, localDay(now, "Asia/Tokyo"))).toBe("Oggi");
    expect(inTokyo.days.filter((d) => d.isToday).length).toBeLessThanOrEqual(1);
  });
});
