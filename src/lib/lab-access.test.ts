import { describe, expect, it } from "vitest";
import { labServed, labRouteServed } from "./lab-access";

describe("labServed (WTH-248)", () => {
  it("serves the labs while developing", () => {
    expect(labServed({ NODE_ENV: "development" }, { previewToo: false })).toBe(true);
    expect(labServed({ NODE_ENV: "development" }, { previewToo: true })).toBe(true);
    expect(labServed({}, { previewToo: false })).toBe(true);
  });

  it("never serves them in a production build, locally or on the live site", () => {
    expect(labServed({ NODE_ENV: "production" }, { previewToo: false })).toBe(false);
    expect(labServed({ NODE_ENV: "production", VERCEL_ENV: "production" }, { previewToo: false })).toBe(false);
    expect(labServed({ NODE_ENV: "production", VERCEL_ENV: "production" }, { previewToo: true })).toBe(false);
  });

  it("serves the record lab, and only it, on Vercel's preview deployments", () => {
    expect(labServed({ NODE_ENV: "production", VERCEL_ENV: "preview" }, { previewToo: true })).toBe(true);
    expect(labServed({ NODE_ENV: "production", VERCEL_ENV: "preview" }, { previewToo: false })).toBe(false);
  });
});

describe("labRouteServed (WTH-248)", () => {
  const production = { NODE_ENV: "production" };
  const preview = { NODE_ENV: "production", VERCEL_ENV: "preview" };

  it("answers the labs' routes 404 in a production build, and serves them while developing", () => {
    expect(labRouteServed("/lab/atmosfera", production)).toBe(false);
    expect(labRouteServed("/lab/record", production)).toBe(false);
    expect(labRouteServed("/lab/atmosfera/", production)).toBe(false);
    expect(labRouteServed("/lab/atmosfera", { NODE_ENV: "development" })).toBe(true);
    expect(labRouteServed("/lab/record", { NODE_ENV: "development" })).toBe(true);
  });

  it("keeps the record lab on Vercel's preview deployments, not the atmosphere lab", () => {
    expect(labRouteServed("/lab/record", preview)).toBe(true);
    expect(labRouteServed("/lab/atmosfera", preview)).toBe(false);
  });

  it("leaves every other path alone, the live pages included", () => {
    for (const path of ["/", "/crea", "/lab", "/laboratorio", "/api/places"]) expect(labRouteServed(path, production)).toBe(true);
  });
});
