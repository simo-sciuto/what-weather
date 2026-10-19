import { describe, expect, it } from "vitest";
import { createMockProvider } from "@/lib/api/providers/mock";
import { parseMapOptions } from "@/lib/map-options";
import { parseMapTuning } from "@/lib/map-tuning";
import { buildTimeline } from "@/lib/weather/frames";
import { mapInksFor } from "@/lib/weather/palette";
import { frameLook } from "@/lib/weather/look";
import type { SkyPalette } from "@/types/palette";
import { activeLayers } from "../weather/map-style";
import { POSTER_MAP_OPTIONS, posterMapPalette } from "./canonical-map";

/** The palette the page draws its map with, from what the browser has stored (`useMapPalette`'s own steps) */
function exploreMap(palette: SkyPalette, tuningRaw: string, optionsRaw: string): SkyPalette {
  return {
    ...palette,
    map: mapInksFor(palette.sky2, parseMapTuning(tuningRaw), activeLayers(parseMapOptions(optionsRaw)), palette.air),
  };
}

async function palettes() {
  const data = await createMockProvider("clear", "12:00").getByCoords(45.07, 7.69);
  const timeline = buildTimeline(data);
  const frames = [timeline.frames[0], timeline.frames[Math.floor(timeline.frames.length / 2)]];
  return frames.map((f) => frameLook(f).palette);
}

/** Choices a viewer may have left on the weather page: a tuned hue, vivid or faint lines, layers switched */
const TUNED = { tuning: JSON.stringify({ hue: 140, vivid: 90, contrast: 20 }), options: JSON.stringify(["water", "train", "buildings"]) };

describe("the poster's map colours (WTH-243)", () => {
  it("are the ones a clean browser's Explore draws: no stored choice in them", async () => {
    for (const palette of await palettes()) {
      expect(posterMapPalette(palette)).toEqual(exploreMap(palette, "", ""));
    }
  });

  it("do not change with the choices Explore keeps in the browser", async () => {
    for (const palette of await palettes()) {
      const clean = posterMapPalette(palette);
      // Other choices, one at a time and together: the poster reads none of them
      expect(posterMapPalette(palette)).toEqual(clean);
      expect(exploreMap(palette, TUNED.tuning, "")).not.toEqual(clean);
      expect(exploreMap(palette, "", TUNED.options)).not.toEqual(clean);
      expect(exploreMap(palette, TUNED.tuning, TUNED.options)).not.toEqual(clean);
    }
  });

  it("use the default layers, whatever the page shows", () => {
    expect(POSTER_MAP_OPTIONS).toEqual(parseMapOptions(""));
  });

  it("keep the moment's sky: only the city's colours are the poster's own", async () => {
    for (const palette of await palettes()) {
      const p = posterMapPalette(palette);
      expect(p.sky2).toBe(palette.sky2);
      expect(p.sky1).toBe(palette.sky1);
    }
  });
});
