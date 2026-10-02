import { MAP_OPTIONS } from "@/lib/map-options";
import { skyPalette, type MapLayer } from "@/lib/weather/palette";
import { sunPosition } from "@/lib/weather/sun-position";
import { describe, expect, it } from "vitest";
import { STYLE, syncMap } from "./map-style";

/** A stand-in for the map that only remembers which layers it was told to show. */
function fakeMap() {
  const visibility = new Map<string, string>();
  const map = {
    setPaintProperty: () => undefined,
    setLayoutProperty: (id: string, key: string, value: string) => {
      if (key === "visibility") visibility.set(id, value);
    },
  };
  const shown = () =>
    [...visibility]
      .filter(([, v]) => v === "visible")
      .map(([id]) => id as MapLayer);
  return { map: map as unknown as Parameters<typeof syncMap>[0], shown };
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

  it("writes the names of the waters only: the river's and the lake's, both with the one choice", () => {
    const { map, shown } = fakeMap();
    syncMap(map, {
      inks,
      options: ["water-names"],
      sun: at("2026-10-01T09:00:00Z"),
      lat,
    });
    expect(shown().sort()).toEqual(["water-names", "waterway-names"]);
    const labels = STYLE.layers.filter((l) => l.type === "symbol");
    expect(labels.map((l) => l.id).sort()).toEqual([
      "water-names",
      "waterway-names",
    ]);
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
