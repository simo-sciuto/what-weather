import { describe, expect, it } from "vitest";
import { centreOffset, centrePoint, formatCenter } from "./center";

describe("where the map's centre is on the screen", () => {
  const size = { width: 800, height: 600 };

  it("is the middle of the screen when nothing is padded", () => {
    expect(centrePoint(size)).toEqual({ x: 400, y: 300 });
    expect(centreOffset()).toEqual({ x: 0, y: 0 });
  });

  it("is the middle of what the padding leaves", () => {
    expect(centrePoint(size, { bottom: 200 })).toEqual({ x: 400, y: 200 });
    expect(centrePoint(size, { top: 100 })).toEqual({ x: 400, y: 350 });
    expect(centrePoint(size, { left: 300 })).toEqual({ x: 550, y: 300 });
    expect(centrePoint(size, { right: 100, bottom: 50, top: 10, left: 20 })).toEqual({ x: 360, y: 280 });
  });

  it("is where a pad that is equal on opposite sides leaves it: the middle", () => {
    expect(centrePoint(size, { left: 120, right: 120, top: 40, bottom: 40 })).toEqual({ x: 400, y: 300 });
  });

  it("moves with the padding alone, whatever the size", () => {
    const pad = { bottom: 200, left: 60 };
    const a = centrePoint({ width: 400, height: 900 }, pad);
    const b = centrePoint({ width: 1200, height: 500 }, pad);
    expect(a.x - 200).toBe(b.x - 600);
    expect(a.y - 450).toBe(b.y - 250);
  });
});

describe("the centre as it is read", () => {
  it("gives latitude and longitude to four decimals, the Italian way", () => {
    expect(formatCenter(7.687, 45.07)).toBe("45,0700° N · 7,6870° E");
    expect(formatCenter(-122.4194, 37.7749)).toBe("37,7749° N · 122,4194° O");
    expect(formatCenter(151.2093, -33.8688)).toBe("33,8688° S · 151,2093° E");
  });

  it("brings a longitude that went round the world back into range", () => {
    expect(formatCenter(200, 10)).toBe("10,0000° N · 160,0000° O");
    expect(formatCenter(-200, 10)).toBe("10,0000° N · 160,0000° E");
    expect(formatCenter(7.687 + 360, 45.07)).toBe("45,0700° N · 7,6870° E");
  });
});
