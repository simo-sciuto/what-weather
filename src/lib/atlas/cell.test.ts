import { describe, expect, it } from "vitest";
import { cellOf, sameCell } from "./cell";

describe("the cell under the map's centre", () => {
  it("is the centre rounded to the cache's precision, two decimals", () => {
    expect(cellOf(7.6874, 45.0749)).toEqual({ lat: 45.07, lon: 7.69 });
    expect(cellOf(7.6849, 45.0751)).toEqual({ lat: 45.08, lon: 7.68 });
  });

  it("puts two centres within the same kilometre in one cell, and distant ones in two", () => {
    expect(sameCell(cellOf(7.6871, 45.0701), cellOf(7.6899, 45.0749))).toBe(true);
    expect(sameCell(cellOf(7.68, 45.07), cellOf(7.7, 45.07))).toBe(false);
    expect(sameCell(cellOf(7.69, 45.07), cellOf(7.69, 45.09))).toBe(false);
  });

  it("brings a longitude that went round the world back into -180 to 180", () => {
    expect(cellOf(200, 10).lon).toBe(-160);
    expect(cellOf(-200, 10).lon).toBe(160);
    expect(cellOf(540, 10).lon).toBe(-180);
    expect(cellOf(180, 10).lon).toBe(-180);
    expect(cellOf(-180, 10).lon).toBe(-180);
    expect(cellOf(-179.999, 10).lon).toBe(-180);
    expect(cellOf(179.994, 10).lon).toBe(179.99);
  });

  it("makes the antimeridian one cell, not two cache keys", () => {
    expect(cellOf(179.996, 10).lon).toBe(-180);
    expect(cellOf(-179.996, 10).lon).toBe(-180);
    expect(sameCell(cellOf(179.999, 10), cellOf(-179.999, 10))).toBe(true);
    for (const lng of [-540, -360.004, -180.001, 0, 179.999, 180, 359.999, 719.5]) {
      const { lon } = cellOf(lng, 0);
      expect(lon, `${lng}`).toBeGreaterThanOrEqual(-180);
      expect(lon, `${lng}`).toBeLessThan(180);
    }
  });

  it("takes the same place seen on two turns of the world for one cell", () => {
    expect(sameCell(cellOf(10.5, 45), cellOf(370.5, 45))).toBe(true);
  });

  it("does not tell -0 from 0", () => {
    expect(sameCell(cellOf(0, -0.001), cellOf(0, 0.001))).toBe(true);
  });

  it("is the same cell only as a cell: nothing is the same as nothing", () => {
    expect(sameCell(null, null)).toBe(false);
    expect(sameCell(cellOf(1, 2), null)).toBe(false);
  });
});
