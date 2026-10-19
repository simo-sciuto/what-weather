import { describe, expect, it } from "vitest";
import type { Lattice } from "@/types/atlas";
import { interpolateField, latticeBox } from "./field-image";

/* WTH-272: the field as pixels. Pure, no canvas. */

const px = (data: Uint8ClampedArray, width: number, x: number, y: number) => Array.from(data.slice((y * width + x) * 4, (y * width + x) * 4 + 4));

describe("the field as pixels", () => {
  // west cold (blue), east warm (red): two places a step apart
  const two: Lattice = { step: 4, lats: [44, 48], lons: [8, 12] };
  const blue = "#0000ff";
  const red = "#ff0000";

  it("is the colours at the places and fades between them, west to east", () => {
    const data = interpolateField(two, [blue, red, blue, red], 64, 16);
    const row = Array.from({ length: 64 }, (_, x) => px(data, 64, x, 8));
    // the ends are the colours (a half pixel in from the corner)
    expect(row[0][2]).toBeGreaterThan(240);
    expect(row[63][0]).toBeGreaterThan(240);
    // red rises and blue falls along the row, one step at a time, never back
    for (let x = 1; x < 64; x++) {
      expect(row[x][0]).toBeGreaterThanOrEqual(row[x - 1][0]);
      expect(row[x][2]).toBeLessThanOrEqual(row[x - 1][2]);
    }
    // halfway is the two in equal parts
    expect(Math.abs(row[32][0] - 128)).toBeLessThan(6);
    expect(row.every((p) => p[3] === 255)).toBe(true);
  });

  it("fades south to north too: Milano is not Roma, the way the map has it", () => {
    const data = interpolateField(two, [blue, blue, red, red], 8, 64);
    const col = Array.from({ length: 64 }, (_, y) => px(data, 8, 4, y));
    // row 0 is the north: red there, blue at the south, a smooth run between
    expect(col[0][0]).toBeGreaterThan(240);
    expect(col[63][2]).toBeGreaterThan(240);
    for (let y = 1; y < 64; y++) expect(col[y][0]).toBeLessThanOrEqual(col[y - 1][0]);
  });

  it("puts the middle row where the map's projection has it, not halfway in degrees", () => {
    // a tall lattice from the equator to 80 degrees: halfway down the picture is much nearer the pole than 40 degrees
    const tall: Lattice = { step: 80, lats: [0, 80], lons: [0, 10] };
    const data = interpolateField(tall, ["#000000", "#000000", "#ffffff", "#ffffff"], 4, 101);
    const mid = px(data, 4, 2, 50)[0];
    // 40 degrees would be exactly half (127); in Mercator the picture's middle is at about 47.7 degrees, so brighter
    expect(mid).toBeGreaterThan(140);
  });

  it("is the edge's colour outside the lattice, and one colour for one colour", () => {
    const flat = interpolateField(two, [blue, blue, blue, blue], 8, 8);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) expect(px(flat, 8, x, y)).toEqual([0, 0, 255, 255]);
  });

  it("copes with a lattice of one row's worth of latitudes pinned at the pole", () => {
    const polar: Lattice = { step: 4, lats: [84, 85, 85], lons: [0, 4] };
    const data = interpolateField(polar, ["#ff0000", "#ff0000", "#00ff00", "#00ff00", "#0000ff", "#0000ff"], 8, 8);
    expect(data.every((v) => Number.isFinite(v))).toBe(true);
  });

  it("reports the box a lattice covers", () => {
    expect(latticeBox(two)).toEqual({ west: 8, east: 12, south: 44, north: 48 });
  });
});
