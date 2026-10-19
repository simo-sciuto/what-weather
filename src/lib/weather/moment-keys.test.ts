import { describe, expect, it } from "vitest";
import { adjacentDay, momentKey } from "./moment-keys";

const days = [
  { key: "2026-10-19", isToday: true },
  { key: "2026-10-20", isToday: false },
  { key: "2026-10-21", isToday: false },
];

describe("the keys of the moment's track", () => {
  it("arrows are an hour, PageUp and PageDown a day, Home is Adesso", () => {
    expect(momentKey("ArrowRight")).toEqual({ kind: "hours", delta: 1 });
    expect(momentKey("ArrowLeft")).toEqual({ kind: "hours", delta: -1 });
    expect(momentKey("PageUp")).toEqual({ kind: "days", delta: 1 });
    expect(momentKey("PageDown")).toEqual({ kind: "days", delta: -1 });
    expect(momentKey("Home")).toEqual({ kind: "now" });
  });

  it("leaves every other key alone", () => {
    for (const key of ["Tab", "Enter", " ", "a", "End", "Escape"]) expect(momentKey(key)).toBeNull();
  });
});

describe("the day next to the one on show", () => {
  it("the next 24 hours belong to today", () => {
    expect(adjacentDay(days, null, 1)).toBe("2026-10-20");
    expect(adjacentDay(days, null, -1)).toBeNull();
  });

  it("moves along the days and stops at the ends of the forecast", () => {
    expect(adjacentDay(days, "2026-10-20", 1)).toBe("2026-10-21");
    expect(adjacentDay(days, "2026-10-20", -1)).toBe("2026-10-19");
    expect(adjacentDay(days, "2026-10-21", 1)).toBeNull();
  });

  it("a day the forecast does not hold has no neighbour", () => {
    expect(adjacentDay(days, "2030-01-01", 1)).toBeNull();
    expect(adjacentDay([], null, 1)).toBeNull();
  });
});
