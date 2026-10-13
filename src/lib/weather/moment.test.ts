import { describe, expect, it } from "vitest";
import { createMockProvider } from "@/lib/api/providers/mock";
import { buildTimeline } from "./frames";
import { momentFrame, momentStart } from "./moment";

async function timeline() {
  const data = await createMockProvider("clear", "13:00").getByCoords(45.46, 9.19);
  return buildTimeline(data);
}

describe("momentStart: the moment chosen on Explore, found in the timeline (WTH-236)", () => {
  it("finds the current conditions: the first hour of the next hours, live", async () => {
    const t = await timeline();
    expect(momentStart(t, t.frames[0].time)).toEqual({ day: null, index: 0, live: true });
  });

  it("finds a later hour of the next hours: a forecast, not live", async () => {
    const t = await timeline();
    expect(momentStart(t, t.frames[5].time)).toEqual({ day: null, index: 5, live: false });
  });

  it("finds an hour of a day picked on Explore, by the day and the position in its hours", async () => {
    const t = await timeline();
    // A day after today, in an hour past the next 24 hours: it is found among that day's hours
    const day = t.days.find((d) => !d.isToday && d.hours.some((h) => h > 25))!;
    const h = day.hours.find((x) => x > 25)!;
    const index = day.hours.indexOf(h);
    expect(momentStart(t, t.frames[h].time)).toEqual({ day: day.key, index, live: false });
  });

  it("finds a day's hour inside the next hours at the same frame: the same instant is the same moment", async () => {
    const t = await timeline();
    const day = t.days.find((d) => !d.isToday && d.hours.length > 3)!;
    const frame = t.frames[day.hours[3]];
    expect(momentFrame(t, momentStart(t, frame.time)!)).toBe(frame);
  });

  it("gives nothing for a moment the timeline does not hold: before it, or past its last hour", async () => {
    const t = await timeline();
    expect(momentStart(t, t.frames[0].time - 3600)).toBeNull();
    expect(momentStart(t, t.frames.at(-1)!.time + 3600 * 1000)).toBeNull();
    expect(momentStart(t, 1000)).toBeNull();
  });
});

describe("momentFrame: the frame on show at a start", () => {
  it("is the frame at the start, for the next hours and for a picked day", async () => {
    const t = await timeline();
    const next = momentStart(t, t.frames[5].time)!;
    expect(momentFrame(t, next)).toBe(t.frames[5]);
    const day = t.days.find((d) => d.hours.length > 3)!;
    const inDay = momentStart(t, t.frames[day.hours[3]].time)!;
    expect(momentFrame(t, inDay)).toBe(t.frames[day.hours[3]]);
  });
});
