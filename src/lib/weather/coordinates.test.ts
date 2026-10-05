import { describe, expect, it } from "vitest";
import { COORD_PRECISION } from "./constants";
import { roundCoord } from "./coordinates";

describe("the coordinate rounding the cache key rests on (ADR-003)", () => {
  it("rounds to the cache's precision, so places a few hundred metres apart share one entry", () => {
    expect(COORD_PRECISION).toBe(2);
    expect(roundCoord(45.4642)).toBe(45.46);
    expect(roundCoord(45.4601)).toBe(roundCoord(45.4649));
    expect(roundCoord(-33.8688)).toBe(-33.87);
  });

  it("keeps whole degrees and an already rounded value as they are", () => {
    expect([roundCoord(9), roundCoord(9.19), roundCoord(0)]).toEqual([9, 9.19, 0]);
  });
});
