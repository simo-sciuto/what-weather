import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Crosshair } from "./Crosshair";

const styleOf = (padding: { top: number; right: number; bottom: number; left: number }) =>
  renderToStaticMarkup(createElement(Crosshair, { port: null, padding })).match(/style="([^"]*)"/)?.[1] ?? "";

describe("Crosshair position", () => {
  it("is the middle of the map with no padding", () => {
    expect(styleOf({ top: 0, right: 0, bottom: 0, left: 0 })).toContain("left:calc(50% + 0px);top:calc(50% + 0px)");
  });
  it("is the middle of what the padding leaves", () => {
    // left 120, right 10: the centre is 55 px right of the middle; top 40, bottom 200: 80 px above it
    expect(styleOf({ top: 40, right: 10, bottom: 200, left: 120 })).toContain("left:calc(50% + 55px);top:calc(50% + -80px)");
  });
  it("is set only by the padding, so a map with the same padding has its centre under it", () => {
    expect(styleOf({ top: 0, right: 100, bottom: 0, left: 0 })).toContain("left:calc(50% + -50px)");
  });
});
