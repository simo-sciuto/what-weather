import { describe, expect, it } from "vitest";
import { createMockProvider } from "@/lib/api/providers/mock";
import { buildTimeline } from "./frames";
import { readMoment, resolveAddressMoment, selectionOfAddress, withMoment } from "./moment-address";

async function source() {
  const data = await createMockProvider("clear", "13:00").getByCoords(45.46, 9.19);
  return { timeline: buildTimeline(data), timezone: data.timezone };
}

describe("readMoment: the moment in the address (ADR-028)", () => {
  it("no t is Adesso", () => {
    expect(readMoment("lat=45&lon=9")).toEqual({ kind: "now" });
    expect(readMoment("t=")).toEqual({ kind: "now" });
  });

  it("t is an instant in Unix seconds", () => {
    expect(readMoment("lat=45&lon=9&t=1792418400")).toEqual({ kind: "at", instant: 1792418400 });
    expect(readMoment(new URLSearchParams("t=1792418400"))).toEqual({ kind: "at", instant: 1792418400 });
  });

  it("with two t the first counts", () => {
    expect(readMoment("t=1792418400&t=1792422000")).toEqual({ kind: "at", instant: 1792418400 });
  });

  it("anything that is not a plausible moment is invalid, never read as another moment", () => {
    for (const raw of ["abc", "12.5", "-5", "1e9", "0", "999999999", "99999999999", "18:00", "1792418400abc"]) {
      expect(readMoment(`t=${raw}`)).toEqual({ kind: "invalid", raw });
    }
  });
});

describe("selectionOfAddress and withMoment: a selection written to the address and read back", () => {
  it("an instant becomes an at selection, anything else Adesso", () => {
    expect(selectionOfAddress({ kind: "at", instant: 1792418400 })).toEqual({ mode: "at", instant: 1792418400 });
    expect(selectionOfAddress({ kind: "now" })).toEqual({ mode: "now" });
    expect(selectionOfAddress({ kind: "invalid", raw: "x" })).toEqual({ mode: "now" });
  });

  it("writes t for an instant and removes it for Adesso, keeping the other parameters and their order", () => {
    expect(withMoment("lat=45.07&lon=7.69&name=Torino", { mode: "at", instant: 1792418400 })).toBe("lat=45.07&lon=7.69&name=Torino&t=1792418400");
    expect(withMoment("lat=45.07&t=1792418400&lon=7.69", { mode: "now" })).toBe("lat=45.07&lon=7.69");
    expect(withMoment("t=1792418400", { mode: "at", instant: 1792422000 })).toBe("t=1792422000");
    expect(withMoment("", { mode: "now" })).toBe("");
  });

  it("round-trips", () => {
    const written = withMoment("lat=45&lon=9", { mode: "at", instant: 1792418400 });
    expect(selectionOfAddress(readMoment(written))).toEqual({ mode: "at", instant: 1792418400 });
  });
});

describe("resolveAddressMoment: what the address's moment shows at a place, and when it shows nothing", () => {
  it("no moment is the live reading", async () => {
    expect(resolveAddressMoment(await source(), { kind: "now" })).toEqual({ status: "now" });
  });

  it("an hour the forecast holds opens on that hour", async () => {
    const s = await source();
    const time = s.timeline.frames[5].time;
    const r = resolveAddressMoment(s, { kind: "at", instant: time });
    expect(r).toMatchObject({ status: "ok", requested: time });
    expect(r.status === "ok" && r.start).toEqual({ day: null, index: 5, live: false });
  });

  it("an instant within half an hour of an hour opens on that hour (the answering one), not on a made-up time", async () => {
    const s = await source();
    const time = s.timeline.frames[5].time;
    const r = resolveAddressMoment(s, { kind: "at", instant: time + 600 });
    expect(r.status === "ok" && r.start.index).toBe(5);
    expect(r.status === "ok" && r.requested).toBe(time + 600);
  });

  it("the first hour is the live reading: a t equal to it opens live, as Create does", async () => {
    const s = await source();
    const r = resolveAddressMoment(s, { kind: "at", instant: s.timeline.frames[0].time });
    expect(r.status === "ok" && r.start).toEqual({ day: null, index: 0, live: true });
  });

  it("an instant before the forecast is unavailable, with the instant that was asked for", async () => {
    const s = await source();
    const asked = s.timeline.frames[0].time - 5 * 86_400;
    expect(resolveAddressMoment(s, { kind: "at", instant: asked })).toEqual({ status: "unavailable", requested: asked, reason: "before-start" });
  });

  it("an instant after the forecast is unavailable", async () => {
    const s = await source();
    const asked = s.timeline.frames[s.timeline.frames.length - 1].time + 60 * 86_400;
    expect(resolveAddressMoment(s, { kind: "at", instant: asked })).toEqual({ status: "unavailable", requested: asked, reason: "beyond-horizon" });
  });

  it("a day the forecast only summarises has no hour to open on: unavailable, not the summary taken for an hour", async () => {
    const s = await source();
    // A timeline whose last day has a summary and no hours: the mock's own days all have hours, so the day is made here
    const day = s.timeline.days[s.timeline.days.length - 1];
    const lastHour = s.timeline.frames[s.timeline.frames.length - 1].time;
    const summaryTime = lastHour + 2 * 86_400;
    const timeline = {
      ...s.timeline,
      days: [...s.timeline.days, { ...day, key: "summary-only", isToday: false, hours: [], overview: { ...day.overview, time: summaryTime } }],
    };
    const r = resolveAddressMoment({ ...s, timeline }, { kind: "at", instant: summaryTime });
    expect(r).toMatchObject({ status: "unavailable", requested: summaryTime });
    // Not the summary taken for an hour: whatever the reason, there is no start
    expect(r.status === "ok").toBe(false);
  });

  it("a bad t is unavailable as invalid, and holds no instant", async () => {
    expect(resolveAddressMoment(await source(), { kind: "invalid", raw: "abc" })).toEqual({ status: "unavailable", requested: null, reason: "invalid" });
  });
});
