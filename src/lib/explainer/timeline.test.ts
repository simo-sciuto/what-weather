import { describe, expect, it } from "vitest";
import { along, clamp01, countTo, DURATION, easeInOutCubic, easeOutBack, easeOutCubic, sceneAt, SCENES, span, stepAt, STEPS } from "./timeline";
import { roadNetwork, seeded, smoothPath } from "./roads";

/* The explainer's clock and its made-up roads. Pure. */

describe("the film's parts", () => {
  it("follow one another with no gap and no overlap, from zero to the end", () => {
    expect(SCENES[0].from).toBe(0);
    for (let i = 1; i < SCENES.length; i++) expect(SCENES[i].from).toBe(SCENES[i - 1].to);
    expect(DURATION).toBe(SCENES.at(-1)!.to);
    expect(DURATION).toBeGreaterThan(14_000);
    expect(DURATION).toBeLessThan(22_000);
  });

  it("have the three steps in the order of the schema: Explore, Create, Keep", () => {
    expect(STEPS.map((s) => s.label)).toEqual(["Explore", "Create", "Keep"]);
    expect(STEPS.map((s) => s.caption)).toEqual(["Scopro un luogo", "Creo un record", "Conservo il risultato"]);
    for (const s of STEPS) expect(SCENES.find((x) => x.id === s.id)).toMatchObject({ from: s.from, to: s.to });
  });
});

describe("which part a time is in", () => {
  it("is the scene and how far through it, for any time, inside the film or not", () => {
    expect(sceneAt(0)).toEqual({ scene: SCENES[0], progress: 0 });
    expect(sceneAt(SCENES[1].from).scene.id).toBe("explore");
    expect(sceneAt((SCENES[2].from + SCENES[2].to) / 2)).toMatchObject({ scene: { id: "create" }, progress: 0.5 });
    expect(sceneAt(-500).scene.id).toBe("intro");
    expect(sceneAt(DURATION + 5000)).toMatchObject({ scene: { id: "outro" }, progress: 1 });
  });

  it("says which step is on, and none in the opening and the close", () => {
    expect([0, 3000, 9000, 14000, 17500].map(stepAt)).toEqual([-1, 0, 1, 2, -1]);
  });
});

describe("the movement", () => {
  it("clamps, and eases from 0 to 1 without leaving them (the overshoot aside)", () => {
    expect([clamp01(-1), clamp01(0.3), clamp01(4)]).toEqual([0, 0.3, 1]);
    expect(span(50, 100, 200)).toBe(0);
    expect(span(150, 100, 200)).toBe(0.5);
    expect(span(900, 100, 200)).toBe(1);
    for (const ease of [easeInOutCubic, easeOutCubic]) {
      expect(ease(0)).toBe(0);
      expect(ease(1)).toBe(1);
      let last = 0;
      for (let t = 0; t <= 1; t += 0.05) {
        expect(ease(t)).toBeGreaterThanOrEqual(last - 1e-9);
        last = ease(t);
      }
    }
    expect(easeOutBack(1)).toBeCloseTo(1, 9);
    expect(Math.max(...Array.from({ length: 21 }, (_, i) => easeOutBack(i / 20)))).toBeGreaterThan(1);
  });

  it("counts a figure up to its value, whole numbers, and lands on it", () => {
    expect(countTo(16, 0)).toBe(0);
    expect(countTo(16, 1)).toBe(16);
    expect(countTo(16, 2)).toBe(16);
    expect(Number.isInteger(countTo(16, 0.37))).toBe(true);
    expect(countTo(-4, 1)).toBe(-4);
  });

  it("goes along waypoints and stops on the last", () => {
    const pts = [[0, 0], [100, 0], [100, 200]] as const;
    expect(along(pts, 0)).toEqual([0, 0]);
    expect(along(pts, 1)).toEqual([100, 200]);
    expect(along(pts, 0.5)).toEqual([100, 0]);
    const [x, y] = along(pts, 0.25);
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(100);
    expect(y).toBe(0);
  });
});

describe("the made-up roads", () => {
  it("are the same every time for the same seed, and another network for another", () => {
    expect(roadNetwork(7, 30, 1280, 720)).toEqual(roadNetwork(7, 30, 1280, 720));
    expect(roadNetwork(7, 30, 1280, 720)).not.toEqual(roadNetwork(8, 30, 1280, 720));
    const a = seeded(1);
    const b = seeded(1);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("are as many as asked, each a real path with a weight and a time to begin", () => {
    const roads = roadNetwork(3, 40, 1280, 720);
    expect(roads).toHaveLength(40);
    for (const r of roads) {
      expect(r.d.startsWith("M")).toBe(true);
      expect(r.d).not.toContain("NaN");
      expect([0.5, 1]).toContain(r.weight);
      expect(r.delay).toBeGreaterThanOrEqual(0);
      expect(r.delay).toBeLessThanOrEqual(1);
    }
    expect(roads.filter((r) => r.weight === 1).length).toBeGreaterThan(3);
  });

  it("draw a smooth line through the points, and nothing through fewer than two", () => {
    expect(smoothPath([[0, 0]])).toBe("");
    expect(smoothPath([[0, 0], [10, 10], [20, 0]])).toMatch(/^M0\.0 0\.0 C/);
  });
});
