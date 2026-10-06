import { describe, expect, it } from "vitest";
import { seaGrid } from "./sea-grid";

/** An empty grid with water filled in by `fill` */
function blank(gw: number, gh: number, fill: (x: number, y: number) => boolean) {
  const g = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) g[y * gw + x] = fill(x, y) ? 1 : 0;
  return { g, gw, gh, at: (out: Uint8Array, x: number, y: number) => out[y * gw + x] };
}

describe("the sea on the water's grid", () => {
  it("reads a large open water as sea, edge to edge", () => {
    const { g, gw, gh, at } = blank(60, 60, (x) => x < 25);
    const sea = seaGrid(g, gw, gh);
    expect(at(sea, 0, 0)).toBe(1);
    expect(at(sea, 24, 30)).toBe(1);
    expect(at(sea, 30, 30)).toBe(0);
  });

  it("leaves a small enclosed lake alone", () => {
    const { g, gw, gh } = blank(60, 60, (x, y) => (x - 30) ** 2 + (y - 30) ** 2 < 36);
    expect(seaGrid(g, gw, gh).some(Boolean)).toBe(false);
  });

  it("stops a narrow river at its mouth", () => {
    // The sea on the left, a river three cells wide running right from it
    const { g, gw, gh, at } = blank(80, 60, (x, y) => x < 25 || (y >= 30 && y < 33));
    const sea = seaGrid(g, gw, gh);
    expect(at(sea, 10, 31)).toBe(1);
    expect(at(sea, 60, 31)).toBe(0);
  });

  it("follows a harbour's wide channel as far as it winds, past the old pass limit", () => {
    // The sea across the top; a channel six cells wide joins it at one end only and zigzags down the sheet, a path
    // far longer than the sheet's width and height together (the old growth stopped after that many passes)
    const [gw, gh] = [60, 200];
    const { g, at } = blank(gw, gh, (_, y) => y < 30);
    const rows = [40, 56, 72, 88, 104, 120, 136, 152, 168, 184];
    const set = (x: number, y: number) => (g[y * gw + x] = 1);
    for (let y = 24; y < rows[0] + 6; y++) for (let d = 0; d < 6; d++) set(4 + d, y);
    rows.forEach((y, k) => {
      for (let x = 4; x < gw - 4; x++) for (let d = 0; d < 6; d++) set(x, y + d);
      const x0 = k % 2 ? 4 : gw - 10;
      if (k < rows.length - 1) for (let yy = y; yy < rows[k + 1] + 6; yy++) for (let d = 0; d < 6; d++) set(x0 + d, yy);
    });
    const sea = seaGrid(g, gw, gh);
    // The channel's far end, reached only along its whole length
    expect(at(sea, gw - 7, 187)).toBe(1);
    expect(at(sea, 30, 48)).toBe(0);
  });

  it("runs at print size over a long harbour in well under a second", () => {
    const [gw, gh] = [620, 877];
    const { g } = blank(gw, gh, (x, y) => x < gw * 0.3 || (y % 40 < 6 && x < gw - 10) || (x % 200 < 6 && y > 20));
    const t = performance.now();
    seaGrid(g, gw, gh);
    expect(performance.now() - t).toBeLessThan(1000);
  });
});
