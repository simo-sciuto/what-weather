import { describe, expect, it } from "vitest";
import { recordClock } from "../poster/usePosterSnapshot";
import { recordTime } from "./record-on-map";

describe("the record's moment as Unix seconds", () => {
  it("reads whole, negative and half-hour offsets, and GMT alone", () => {
    const at = (time: string, zone: string) => recordTime({ date: "2026-10-05", time, zone });
    expect(at("12:00", "GMT+2")).toBe(Date.parse("2026-10-05T10:00:00Z") / 1000);
    expect(at("07:00", "GMT-3")).toBe(Date.parse("2026-10-05T10:00:00Z") / 1000);
    expect(at("15:30", "GMT+5:30")).toBe(Date.parse("2026-10-05T10:00:00Z") / 1000);
    expect(at("10:00", "GMT")).toBe(Date.parse("2026-10-05T10:00:00Z") / 1000);
  });

  it("turns the place's clock back into the instant it was read from", () => {
    const ts = Date.parse("2026-10-05T10:00:00Z") / 1000;
    for (const zone of ["Europe/Rome", "Asia/Kolkata", "America/St_Johns", "Asia/Kathmandu", "UTC"])
      expect(recordTime({ date: "2026-10-05", ...recordClock(ts, zone) }), zone).toBe(ts);
  });
});
