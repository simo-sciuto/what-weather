import { describe, expect, it } from "vitest";
import { hexToRgb, hexToRgba } from "./color";

describe("color utils", () => {
  it("reads a hex colour as three bytes", () => {
    expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
    expect(hexToRgb("#ffffff")).toEqual([255, 255, 255]);
    expect(hexToRgb("#f9e8a7")).toEqual([249, 232, 167]);
  });

  it("writes it with an alpha, as the canvas and Mapbox read it", () => {
    expect(hexToRgba("#f9e8a7", 0.5)).toBe("rgba(249, 232, 167, 0.5)");
    expect(hexToRgba("#000000", 0)).toBe("rgba(0, 0, 0, 0)");
    expect(hexToRgba("#0a141e", 1)).toBe("rgba(10, 20, 30, 1)");
  });
});
