import { describe, expect, it } from "vitest";
import { createAtmosphere, type AtmosphereAxes } from "@/lib/weather/atmosphere";
import { recordMode, typeVisualState } from "@/lib/weather/typography";
import { conditionFamily } from "./condition-family";
import { getRecordComposition } from "./compose";
import { fitPlace } from "./fit";
import { clipLine, clipRing, crossings } from "./geography";
import { recordInks, PAPER, RECORD_ACCENT } from "./inks";
import { tempColor } from "@/lib/weather/temp-color";
import { formatCoord, metricsFor, recordId, temperatureWords } from "./metrics";
import { hash32, mulberry32, placeSlug, recordSeed } from "./seed";
import { clampAxes, DISPLAY_AXES } from "./type-system";
import { renderSvg } from "./render-svg";
import { EDGE_RECORDS, SPIKE_RECORDS } from "./fixtures/records";
import type { FontRef, Measure, Point, RecordInput, RecordScene } from "./types";

/** A fixed type measure: 0.6 em per character, scaled by the width axis, plus tracking */
const measure: Measure = (text: string, f: FontRef) =>
  text.length * f.size * (f.family === "mono" ? 0.6 : 0.6 * (f.wdth / 100)) + Math.max(0, text.length - 1) * f.tracking * f.size;

const ALL = [...SPIKE_RECORDS, ...EDGE_RECORDS];
const byKey = (k: string) => ALL.find((r) => r.key === k)!;
const compose = (k: string, patch: Partial<RecordInput> = {}) => {
  const r = byKey(k);
  return getRecordComposition({ ...r.input, ...patch }, r.geography, measure);
};
const axes = (a: Partial<AtmosphereAxes>): AtmosphereAxes =>
  createAtmosphere({ daylight: 1, warmth: 0, cloudiness: 0, haze: 0, wetness: 0, severity: 0, snow: 0, energy: 0, ...a });

describe("condition family", () => {
  it("maps every normalized condition, with wind taking over clear and cloud only", () => {
    expect(conditionFamily({ condition: "clear" })).toBe("CLEAR");
    expect(conditionFamily({ condition: "partly-cloudy" })).toBe("CLOUD");
    expect(conditionFamily({ condition: "cloudy" })).toBe("CLOUD");
    expect(conditionFamily({ condition: "fog" })).toBe("FOG");
    expect(conditionFamily({ condition: "drizzle" })).toBe("RAIN");
    expect(conditionFamily({ condition: "rain" })).toBe("RAIN");
    expect(conditionFamily({ condition: "thunderstorm" })).toBe("STORM");
    expect(conditionFamily({ condition: "snow" })).toBe("SNOW");
    expect(conditionFamily({ condition: "clear", windSpeed: 45 })).toBe("WIND");
    expect(conditionFamily({ condition: "rain", windSpeed: 60 })).toBe("RAIN");
  });
});

describe("type engine (typeVisualState)", () => {
  it("chooses the mode from the atmosphere", () => {
    expect(recordMode(axes({ warmth: 0.7 }))).toBe("collision");
    expect(recordMode(axes({ severity: 0.8, wetness: 0.9 }))).toBe("collision");
    expect(recordMode(axes({ wetness: 0.6, cloudiness: 1 }))).toBe("field-record");
    expect(recordMode(axes({ snow: 0.5, cloudiness: 1 }))).toBe("open-atlas");
    expect(recordMode(axes({ cloudiness: 0.95 }))).toBe("field-record");
    expect(recordMode(axes({ cloudiness: 1, haze: 1 }))).toBe("open-atlas");
  });

  it("is heavy and narrow in the heat, light and wide in the cold, within the font's axes", () => {
    const hot = typeVisualState(axes({ warmth: 1 }));
    const cold = typeVisualState(axes({ warmth: -1 }));
    expect(hot.display.weight).toBeGreaterThan(cold.display.weight);
    expect(hot.display.width).toBeLessThan(cold.display.width);
    expect(hot.bleed).toBeGreaterThan(0);
    expect(cold.bleed).toBe(0);
    for (const t of [hot, cold]) {
      expect(t.display.weight).toBeGreaterThanOrEqual(100);
      expect(t.display.weight).toBeLessThanOrEqual(900);
      expect(t.display.width).toBeGreaterThanOrEqual(62);
      expect(t.display.width).toBeLessThanOrEqual(125);
    }
    expect(typeVisualState(axes({ haze: 1 })).tone).toBeCloseTo(0.22, 2);
  });

  it("gives the hand-made posters' settings for Tshuru and Tokyo", () => {
    const tshuru = compose("tshuru").metadata;
    expect(tshuru.mode).toBe("collision");
    expect(tshuru.type.display.width).toBe(62);
    expect(Math.round(tshuru.type.display.weight)).toBe(880);
    expect(tshuru.type.scale).toBeCloseTo(0.79, 2);
    const tokyo = compose("tokyo").metadata;
    expect(tokyo.mode).toBe("field-record");
    expect(tokyo.dominant).toBe("place");
    expect(Math.abs(tokyo.type.display.weight - 835)).toBeLessThan(5);
    expect(compose("milan").metadata.mode).toBe("open-atlas");
  });
});

describe("determinism", () => {
  it("gives the same scene and seed for the same input", () => {
    expect(compose("tokyo")).toEqual(compose("tokyo"));
    expect(recordSeed("Tokyo", "2026-10-05", "RAIN")).toBe(recordSeed("Tokyo", "2026-10-05", "RAIN"));
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("keeps the major decisions when only the date changes; the seed may differ", () => {
    const a = compose("oslo");
    const b = compose("oslo", { date: "2026-11-12" });
    expect(b.metadata.seed).not.toBe(a.metadata.seed);
    for (const k of ["mode", "family", "dominant", "interplay"] as const) expect(b.metadata[k]).toBe(a.metadata[k]);
    expect(b.metadata.type).toEqual(a.metadata.type);
    expect(b.metadata.recordId).toBe("WW / 2026 / 316 / OSLO");
  });

  it("hashes with FNV-1a and slugs names, Latin or not", () => {
    expect(hash32("")).toBe(0x811c9dc5);
    expect(hash32("a")).toBe(0xe40c292c);
    expect(placeSlug("San Cristóbal de las Casas")).toBe("SAN-CRISTOBAL-DE-LAS-CASAS");
    expect(placeSlug("Łódź")).toBe("LODZ");
    expect(placeSlug("東京")).toMatch(/^X[0-9A-Z]+$/);
    expect(placeSlug("東京")).not.toBe(placeSlug("大阪"));
  });
});

describe("place fitting", () => {
  const base: FontRef = { family: "display", wght: 800, wdth: 125, size: 0.25, tracking: 0 };
  it("keeps a short name at the preferred size, never enlarged to fill", () => {
    const f = fitPlace("OSLO", { font: base, wdthMin: 62, maxWidth: 0.88, minSize: 0.1, maxLines: 3, measure });
    expect(f.step).toBe("preferred");
    expect(f.font.size).toBe(0.25);
  });

  it("narrows, wraps on whole words and stays within three lines for a long name", () => {
    const f = fitPlace("SAN CRISTOBAL DE LAS CASAS", { font: { ...base, size: 0.3 }, wdthMin: 62, maxWidth: 0.88, minSize: 0.1, maxLines: 3, measure });
    expect(f.lines.length).toBeLessThanOrEqual(3);
    expect(f.lines.join(" ")).toBe("SAN CRISTOBAL DE LAS CASAS");
    expect(f.width).toBeLessThanOrEqual(0.88 + 1e-9);
    expect(f.font.wdth).toBeGreaterThanOrEqual(DISPLAY_AXES.wdth[0]);
  });

  it("never truncates a single long word: the long-name setting scales it to the measure", () => {
    const f = fitPlace("LLANFAIRPWLLGWYNGYLLGOGERYCHWYRNDROBWLL", { font: { ...base, size: 0.3 }, wdthMin: 62, maxWidth: 0.88, minSize: 0.1, maxLines: 3, measure });
    expect(f.step).toBe("long-name");
    expect(f.lines).toEqual(["LLANFAIRPWLLGWYNGYLLGOGERYCHWYRNDROBWLL"]);
    expect(f.width).toBeLessThanOrEqual(0.88 + 1e-9);
  });

  it("turns a long name in a field record instead of stacking its letters", () => {
    expect(compose("tokyo").metadata.placeFit).toMatch(/^stacked/);
    expect(compose("tokyo", { place: { name: "Rio de Janeiro", lat: 35.68, lon: 139.77 } }).metadata.placeFit).toMatch(/^turned/);
  });
});

describe("font axes", () => {
  it("clamps every axis to the font's real range", () => {
    const f = clampAxes({ family: "display", wght: 1200, wdth: 40, size: 0.1, tracking: 0 });
    expect(f.wght).toBe(900);
    expect(f.wdth).toBe(100); // Inter Tight has one width
    expect(clampAxes({ family: "mono", wght: 700, wdth: 80, size: 0.1, tracking: 0 })).toMatchObject({ wght: 500, wdth: 100 });
  });

  it("never asks for an axis outside the range in any test record", () => {
    for (const r of ALL)
      for (const l of getRecordComposition(r.input, r.geography, measure).layers)
        if (l.payload.kind === "text" && l.payload.font.family === "display") {
          expect(l.payload.font.wght).toBeGreaterThanOrEqual(100);
          expect(l.payload.font.wght).toBeLessThanOrEqual(900);
          expect(l.payload.font.wdth).toBeGreaterThanOrEqual(62);
          expect(l.payload.font.wdth).toBeLessThanOrEqual(125);
        }
  });
});

describe("metrics", () => {
  it("fills a cluster a missing reading left short, never with an empty value", () => {
    const fog = byKey("milan-no-visibility").input;
    const m = metricsFor(["visibility", "humidity", "wind"], fog, 3, []);
    expect(m.map((x) => x.key)).not.toContain("visibility");
    expect(m).toHaveLength(3);
    expect(m.every((x) => x.value.length > 0)).toBe(true);
    const texts = compose("tshuru-no-uv").layers.flatMap((l) => (l.payload.kind === "text" ? l.payload.lines.map((x) => x.text) : []));
    expect(texts).not.toContain("UV");
    expect(texts.every((t) => t.trim().length > 0)).toBe(true);
  });

  it("prints archival coordinates, record IDs and the temperature in words", () => {
    expect(formatCoord(-4.4667, "lat")).toBe("04°28'S");
    expect(formatCoord(29.1, "lon")).toBe("29°06'E");
    expect(recordId("Tshuru", "2026-10-05")).toBe("WW / 2026 / 278 / TSHURU");
    expect(temperatureWords(31)).toBe("thirty-one");
    expect(temperatureWords(-24)).toBe("minus twenty-four");
    expect(temperatureWords(8)).toBe("eight");
    expect(temperatureWords(61)).toBe("61");
  });
});

describe("the city and the inks", () => {
  const accentLayers = (s: RecordScene) => s.layers.filter((l) => l.inkRole === "accent");

  it("marks the city once, in the one accent, tied to the type by a leader", () => {
    for (const r of ALL) {
      const s = getRecordComposition(r.input, r.geography, measure);
      expect(accentLayers(s).map((l) => l.id)).toEqual(["node-city"]);
      expect(s.layers.some((l) => l.id === "leader")).toBe(true);
      expect(s.metadata.nodes).toEqual(["city"]);
    }
  });

  it("works without geography", () => {
    const s = compose("no-geography");
    expect(s.metadata.interplay).toBe("none");
    expect(s.layers.some((l) => l.role === "linework")).toBe(false);
  });

  it("tints the paper with the warmth and keeps the accent fixed", () => {
    expect(recordInks(axes({ warmth: 1 })).paper).toBe(PAPER.warm.toLowerCase());
    expect(recordInks(axes({ warmth: -1 })).paper).toBe(PAPER.cool.toLowerCase());
    expect(recordInks(axes({ warmth: -1, haze: 1 })).paper).toBe(PAPER.haze.toLowerCase());
    expect(recordInks(axes({})).accent).toBe(RECORD_ACCENT);
  });

  it("never lays water over a minus sign", () => {
    const s = compose("reykjavik");
    const minus = s.layers.find((l) => l.id === "minus")!;
    const water = s.layers.find((l) => l.id === "water");
    expect(minus.role).toBe("type-front");
    if (water) expect(water.z).toBeLessThan(minus.z);
  });

  it("rejects a record without a name", () => {
    expect(() => compose("oslo", { place: { name: "  ", lat: 0, lon: 0 } })).toThrow();
  });
});

describe("over the site's own map (raster)", () => {
  const raster = (k: string) => {
    const r = byKey(k);
    return getRecordComposition(r.input, r.geography, measure, undefined, "raster");
  };

  it("hands the map and its cut to the renderer, the cut inside the large type only", () => {
    for (const k of ["milan", "tshuru", "tokyo"]) {
      const s = raster(k);
      const map = s.layers.find((l) => l.id === "map")!;
      const cut = s.layers.find((l) => l.id === "map-cut")!;
      expect(map.payload).toMatchObject({ kind: "image", key: "map" });
      expect(cut.payload).toMatchObject({ kind: "image", key: "map-cut" });
      expect(cut.inkRole).toBe("paper");
      const back = s.layers.filter((l) => l.role === "type-back").map((l) => l.id);
      expect(cut.clip?.glyphsOf).toEqual(back);
      expect(map.z).toBeLessThan(Math.min(...s.layers.filter((l) => l.role === "type-back").map((l) => l.z)));
      expect(cut.z).toBeGreaterThan(Math.max(...s.layers.filter((l) => l.role === "type-back").map((l) => l.z)));
      // The engine's own line geography is not drawn over a real map
      expect(s.layers.some((l) => l.payload.kind === "paths" && ["water", "coast", "river", "border"].includes(l.id))).toBe(false);
    }
  });

  it("keeps the map out of the head band and, in an atlas, under the foot rule", () => {
    const band = raster("milan").layers.find((l) => l.id === "map")!.clip!.rect!;
    expect(band.y).toBeCloseTo(64 / 840, 3);
    expect(band.y + band.height).toBeCloseTo(752 / 840, 3);
    const open = raster("tshuru").layers.find((l) => l.id === "map")!.clip!.rect!;
    expect(open.y + open.height).toBeCloseTo(1, 3);
  });

  it("sets the place's name in the temperature's colour and centres a column of letters", () => {
    const s = raster("tokyo");
    expect(s.inks["ink-2"]).toBe(tempColor(18));
    const letters = s.layers.filter((l) => /^place(-\d+)?$/.test(l.id));
    expect(letters.length).toBe(5);
    for (const l of letters) expect(l.inkRole).toBe("ink-2");
    const ys = letters.map((l) => (l.payload.kind === "text" ? l.payload.lines[0].y : 0));
    const size = letters[0].payload.kind === "text" ? letters[0].payload.font.size : 0;
    // From the first cap's top (y in height units: size is in width units) to the last baseline, around the middle
    const top = ys[0] - (0.72 * size * 2480) / 3508;
    expect((top + ys[ys.length - 1]) / 2).toBeCloseTo(0.5, 2);
  });

  it("sets the small type with a halo of the paper, white type and the one accent", () => {
    const s = raster("tokyo");
    const micro = s.layers.filter((l) => l.payload.kind === "text" && l.payload.font.family === "mono");
    expect(micro.length).toBeGreaterThan(0);
    for (const l of micro) expect(l.payload).toMatchObject({ halo: "paper" });
    expect(s.inks.accent).toBe(RECORD_ACCENT);
    expect(s.inks["ink-1"]).toBe("#f3efe6");
    expect(s.metadata.cityAt[0]).toBeGreaterThan(0);
    expect(s.metadata.cityAt[1]).toBeGreaterThan(0);
  });

  it("puts the pictures it is given into the SVG", () => {
    const svg = renderSvg(raster("oslo"), "swiss-flat", { width: 620, height: 877, images: { map: "data:image/png;base64,AA==", "map-cut": "data:image/png;base64,BB==" } });
    expect(svg).toContain('href="data:image/png;base64,AA=="');
    expect(svg).toContain('href="data:image/png;base64,BB=="');
    expect(svg).toContain('paint-order="stroke"');
  });
});

describe("geography", () => {
  const box = { x: 0, y: 0, w: 1, h: 1 };
  it("cuts lines and rings at the slot and finds crossings", () => {
    const l: Point[] = [
      [-1, 0.5],
      [0.5, 0.5],
      [2, 0.5],
    ];
    expect(clipLine(l, box)).toEqual([
      [
        [0, 0.5],
        [0.5, 0.5],
        [1, 0.5],
      ],
    ]);
    const ring = clipRing(
      [
        [-1, -1],
        [0.5, -1],
        [0.5, 0.5],
        [-1, 0.5],
      ],
      box,
    );
    expect(ring.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1)).toBe(true);
    const placed = { coast: [l], border: [], river: [], water: [] };
    expect(crossings(placed, "coast", [0.3, 0], [0.3, 1])).toEqual([[0.3, 0.5]]);
  });
});

describe("Swiss Flat renderer", () => {
  it("draws a scene to SVG with only the scene's four inks", () => {
    const s = compose("tshuru");
    const svg = renderSvg(s, "swiss-flat", { width: 620, height: 877 });
    expect(svg.startsWith("<svg")).toBe(true);
    const colours = new Set([...svg.matchAll(/(?:fill|stroke)="(#[0-9a-fA-F]{6})"/g)].map((m) => m[1].toLowerCase()));
    const inks = Object.values(s.inks).map((c) => c.toLowerCase());
    for (const c of colours) expect(inks).toContain(c);
  });
});
