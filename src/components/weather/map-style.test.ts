import { MAP_OPTIONS } from "@/lib/map-options";
import { skyPalette, type MapLayer } from "@/lib/weather/palette";
import { sunPosition } from "@/lib/weather/sun-position";
import { describe, expect, it } from "vitest";
import { coreOf, STYLE, syncMap } from "./map-style";

/** A stand-in for the map that only remembers which layers it was told to show, and the paint it was given. */
function fakeMap() {
  const visibility = new Map<string, string>();
  const paint = new Map<string, unknown>();
  const map = {
    setPaintProperty: (id: string, key: string, value: unknown) => {
      paint.set(`${id}/${key}`, value);
    },
    setLayoutProperty: (id: string, key: string, value: string) => {
      if (key === "visibility") visibility.set(id, value);
    },
  };
  const shown = () =>
    [...visibility]
      .filter(([, v]) => v === "visible")
      .map(([id]) => id as MapLayer);
  return { map: map as unknown as Parameters<typeof syncMap>[0], shown, paint, visibility };
}

const inks = skyPalette({ state: "CLEAR_DAY", cloudCover: 0, light: 0.5 }).map;
const [lat, lon] = [45.07, 7.68];
const at = (iso: string) => sunPosition(Date.parse(iso) / 1000, lat, lon);

describe("syncMap", () => {
  it("starts with every extra layer hidden, so what isn't chosen asks for no tiles", () => {
    const extras = STYLE.layers
      .filter((l) => "layout" in l && l.layout?.visibility === "none")
      .map((l) => l.id);
    expect(extras).toEqual(
      expect.arrayContaining([
        "green",
        "relief",
        "shadows",
        "traffic-jam",
        "lights",
      ]),
    );
    expect(STYLE.layers.find((l) => l.id === "motorways")).not.toHaveProperty(
      "layout",
    );
  });

  it("shows nothing extra until something is chosen", () => {
    const { map, shown } = fakeMap();
    syncMap(map, { inks, options: [], sun: at("2026-10-01T09:00:00Z"), lat });
    expect(shown()).toEqual([]);
  });

  it("shows an option's layers, the traffic's three ranks together", () => {
    const { map, shown } = fakeMap();
    syncMap(map, {
      inks,
      options: ["traffic", "green"],
      sun: at("2026-10-01T09:00:00Z"),
      lat,
    });
    expect(shown().sort()).toEqual([
      "green",
      "traffic-heavy",
      "traffic-jam",
      "traffic-slow",
    ]);
  });

  it("draws no words on the map: the page's own stay on the page", () => {
    expect(STYLE.layers.filter((l) => l.type === "symbol")).toEqual([]);
    expect(STYLE).not.toHaveProperty("glyphs");
  });

  it("shows the buildings in 3D as volumes as tall as they are, apart from their outlines", () => {
    const extrusion = STYLE.layers.find((l) => l.id === "buildings-3d");
    expect(extrusion?.type).toBe("fill-extrusion");
    expect(extrusion).toMatchObject({
      layout: { visibility: "none" },
      paint: { "fill-extrusion-height": expect.anything() },
    });

    const only3d = fakeMap();
    syncMap(only3d.map, {
      inks,
      options: ["buildings-3d"],
      sun: at("2026-10-01T09:00:00Z"),
      lat,
    });
    expect(only3d.shown()).toEqual(["buildings-3d"]);

    const outlines = fakeMap();
    syncMap(outlines.map, {
      inks,
      options: ["buildings"],
      sun: at("2026-10-01T09:00:00Z"),
      lat,
    });
    expect(outlines.shown()).toEqual(["buildings"]);
  });

  it("casts shadows by day and lights the city by night, never the other way round", () => {
    const day = fakeMap();
    syncMap(day.map, {
      inks,
      options: MAP_OPTIONS,
      sun: at("2026-10-01T09:00:00Z"),
      lat,
    });
    expect(day.shown()).toContain("shadows");
    expect(day.shown()).not.toContain("lights");

    const night = fakeMap();
    syncMap(night.map, {
      inks,
      options: MAP_OPTIONS,
      sun: at("2026-10-01T22:00:00Z"),
      lat,
    });
    expect(night.shown()).toContain("lights");
    expect(night.shown()).not.toContain("shadows");
  });
});

describe("the stops of the ways of getting about (WTH-180)", () => {
  const layer = (id: string) => STYLE.layers.find((l) => l.id === id);
  const paintOf = (id: string) => (layer(id) as { paint?: Record<string, unknown> } | undefined)?.paint ?? {};
  const STOPS = ["train-stops", "metro-stops", "tram-stops", "bus-stops"];

  it("draws no outline on a dot: no black stroke, no grey fill left from the old look", () => {
    for (const id of [...STOPS, coreOf("train-stops"), coreOf("metro-stops")]) {
      const json = JSON.stringify(paintOf(id));
      expect(json, id).not.toContain("#000000");
      expect(paintOf(id)["circle-stroke-opacity"] === 0.25, id).toBe(false);
    }
  });

  it("gives each mode its own form: roundels for the train and the metro, a ring for the tram, a dot for the bus", () => {
    // A ring: no fill, a stroke that grows with the zoom; the core is a layer above it
    for (const id of ["train-stops", "metro-stops", "tram-stops"]) {
      expect(paintOf(id)["circle-opacity"], `${id} has no fill`).toBe(0);
      expect(paintOf(id)["circle-stroke-width"], `${id} has a stroke`).toBeDefined();
    }
    for (const id of ["train-stops", "metro-stops"]) {
      const [ring, core] = [STYLE.layers.findIndex((l) => l.id === id), STYLE.layers.findIndex((l) => l.id === coreOf(id))];
      expect(core, `${id} has a core, drawn above its ring`).toBeGreaterThan(ring);
      expect(paintOf(coreOf(id))["circle-stroke-width"]).toBeUndefined();
    }
    expect(layer(coreOf("tram-stops"))).toBeUndefined();
    // The bus: one solid dot, with no ring and no stroke
    expect(paintOf("bus-stops")["circle-opacity"]).not.toBe(0);
    expect(paintOf("bus-stops")["circle-stroke-width"]).toBeUndefined();
    expect(layer(coreOf("bus-stops"))).toBeUndefined();
  });

  it("weighs the modes: the metro's roundel is heavier than the train's, the train's than the tram's ring", () => {
    const at17 = (id: string, key: string) => {
      const expr = paintOf(id)[key] as unknown[];
      return expr[expr.length - 1] as number;
    };
    expect(at17("metro-stops", "circle-radius")).toBeGreaterThan(at17("train-stops", "circle-radius"));
    expect(at17("metro-stops", "circle-stroke-width")).toBeGreaterThan(at17("train-stops", "circle-stroke-width"));
    expect(at17("train-stops", "circle-radius")).toBeGreaterThan(at17("tram-stops", "circle-radius"));
    expect(at17(coreOf("metro-stops"), "circle-radius")).toBeGreaterThan(at17(coreOf("train-stops"), "circle-radius"));
    expect(at17("tram-stops", "circle-radius")).toBeGreaterThan(at17("bus-stops", "circle-radius"));
  });

  it("starts hidden, core and ring alike, and shows and hides them together", () => {
    for (const id of [...STOPS, coreOf("train-stops"), coreOf("metro-stops")])
      expect((layer(id) as { layout?: { visibility?: string } }).layout?.visibility, id).toBe("none");
    const { map, visibility } = fakeMap();
    syncMap(map, { inks, options: ["metro", "bus"], sun: at("2026-10-01T09:00:00Z"), lat });
    expect(visibility.get("metro-stops")).toBe("visible");
    expect(visibility.get(coreOf("metro-stops"))).toBe("visible");
    expect(visibility.get("bus-stops")).toBe("visible");
    for (const id of ["train-stops", coreOf("train-stops"), "tram-stops"]) expect(visibility.get(id), id).toBe("none");
  });

  it("paints the ring's stroke and the core in the stop's ink, and the ring with no fill", () => {
    const { map, paint } = fakeMap();
    syncMap(map, { inks, options: ["train", "tram", "bus"], sun: at("2026-10-01T09:00:00Z"), lat });
    for (const id of ["train-stops", "tram-stops"] as const) {
      expect(paint.get(`${id}/circle-opacity`), `${id} fill`).toBe(0);
      expect(paint.get(`${id}/circle-stroke-color`)).toBe(inks[id].color);
      expect(paint.get(`${id}/circle-stroke-opacity`)).toBe(inks[id].opacity);
    }
    expect(paint.get(`${coreOf("train-stops")}/circle-color`)).toBe(inks["train-stops"].color);
    expect(paint.get(`${coreOf("train-stops")}/circle-opacity`)).toBe(inks["train-stops"].opacity);
    expect(paint.get("bus-stops/circle-color")).toBe(inks["bus-stops"].color);
    expect(paint.get("bus-stops/circle-opacity")).toBe(inks["bus-stops"].opacity);
  });
});
