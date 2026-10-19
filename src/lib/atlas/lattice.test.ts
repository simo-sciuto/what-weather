import { describe, expect, it } from "vitest";
import { FIELD_MAX_POINTS, FIELD_STEPS } from "@/constants/atlas";
import { latticeFor, sameLattice, viewBounds } from "./lattice";

/* WTH-272: the lattice of the weather field. Pure. */

const ITALY = { west: 6.6, south: 36.6, east: 18.5, north: 47.1 };

describe("the lattice of a view", () => {
  it("covers the view, on a fixed grid, with no more points than the cap", () => {
    const l = latticeFor(ITALY);
    expect(l.lats.length * l.lons.length).toBeLessThanOrEqual(FIELD_MAX_POINTS);
    expect(l.lats[0]).toBeLessThanOrEqual(ITALY.south);
    expect(l.lats.at(-1)!).toBeGreaterThanOrEqual(ITALY.north);
    expect(l.lons[0]).toBeLessThanOrEqual(ITALY.west);
    expect(l.lons.at(-1)!).toBeGreaterThanOrEqual(ITALY.east);
    // every point is a whole number of steps from the origin
    for (const v of [...l.lats, ...l.lons]) expect(Math.abs(v / l.step - Math.round(v / l.step))).toBeLessThan(1e-3);
  });

  it("is the finest step that fits: a view of a town has the finest step, the world the coarsest", () => {
    expect(latticeFor({ west: 7.6, south: 45.0, east: 7.8, north: 45.15 }).step).toBe(FIELD_STEPS[0]);
    expect(latticeFor({ west: -180, south: -85, east: 180, north: 85 }).step).toBe(FIELD_STEPS.at(-1));
    const steps = [0.2, 1, 3, 8, 20, 60, 180].map((span) => latticeFor({ west: 0, south: 0, east: span, north: span / 1.5 }).step);
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1]);
  });

  it("never asks for more than the cap, whatever the box", () => {
    for (const span of [0.01, 0.5, 2, 5, 12, 40, 90, 200, 400]) {
      for (const lat of [-80, 0, 45, 84]) {
        const l = latticeFor({ west: 7 - span / 2, east: 7 + span / 2, south: lat - span / 3, north: lat + span / 3 });
        expect(l.lats.length * l.lons.length).toBeLessThanOrEqual(FIELD_MAX_POINTS);
        expect(l.lats.length).toBeGreaterThanOrEqual(2);
        expect(l.lons.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("is the same lattice for the same view and for a view nudged within the grid, and different for another place", () => {
    const a = latticeFor({ west: 7.61, south: 45.02, east: 7.9, north: 45.2 });
    const b = latticeFor({ west: 7.63, south: 45.03, east: 7.88, north: 45.19 });
    expect(sameLattice(a, b)).toBe(true);
    expect(sameLattice(a, latticeFor({ west: 12.4, south: 41.8, east: 12.7, north: 42.0 }))).toBe(false);
    expect(sameLattice(a, null)).toBe(false);
  });

  it("keeps latitudes where the projection has them, and a box given the wrong way round", () => {
    const l = latticeFor({ west: 0, east: 10, south: 89, north: 80 });
    expect(Math.max(...l.lats)).toBeLessThanOrEqual(85);
    expect(l.lats).toEqual([...l.lats].sort((x, y) => x - y));
  });
});

describe("the box a camera sees", () => {
  const camera = { lng: 7.687, lat: 45.07, zoom: 8, pitch: 0, bearing: 0 };

  it("is centred on the camera and narrower as the map comes close", () => {
    const wide = viewBounds({ ...camera, zoom: 5 }, { width: 1440, height: 900 });
    const near = viewBounds(camera, { width: 1440, height: 900 });
    expect((near.west + near.east) / 2).toBeCloseTo(camera.lng, 6);
    expect(near.east - near.west).toBeLessThan(wide.east - wide.west);
    expect(near.north).toBeGreaterThan(camera.lat);
    expect(near.south).toBeLessThan(camera.lat);
  });

  it("spans what a screen of that width shows at that zoom (512 px tiles)", () => {
    const b = viewBounds({ ...camera, zoom: 0 }, { width: 512, height: 512 });
    expect(b.east - b.west).toBeCloseTo(360, 6);
    const z8 = viewBounds({ ...camera, lat: 0 }, { width: 1440, height: 900 });
    expect(z8.east - z8.west).toBeCloseTo((1440 / (512 * 256)) * 360, 6);
  });

  it("is larger when the map is turned, to the diagonal", () => {
    const flat = viewBounds(camera, { width: 1440, height: 900 });
    const turned = viewBounds({ ...camera, bearing: 30 }, { width: 1440, height: 900 });
    expect(turned.east - turned.west).toBeGreaterThan(flat.east - flat.west);
    expect(turned.north - turned.south).toBeGreaterThan(flat.north - flat.south);
  });
});
