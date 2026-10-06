import type { MapOption } from "../map-options";
import { inkOverSky } from "./palette";
import type { MapInk, SkyPalette } from "@/types/palette";

/**
 * The colour that stands for each choice of the map, as it shows over the
 * middle of the sky: what the choice's chip in the controls and on the poster
 * is filled with. It follows everything the viewer tuned (the hue, the
 * intensity and, through the lines' opacity, the contrast).
 */
export function optionColor(p: SkyPalette, option: MapOption): string {
  const { map } = p;
  const over = (ink: MapInk, color = ink.color) => inkOverSky(p.sky2, { color, opacity: ink.opacity });
  switch (option) {
    case "water":
      return over(map.water);
    case "streets":
      return over(map.streets);
    case "main-roads":
      return over(map["main-roads"]);
    case "motorways":
      return over(map.motorways);
    case "green":
      return over(map.green);
    // The relief is shading: its shadow's colour
    case "relief":
      return over(map.shadows);
    // The contours are a ramp of colours: the middle of it stands for them
    case "contours":
      return over(map.contours, map.contours.ramp?.[3]);
    case "train":
      return over(map.train);
    case "metro":
      return over(map.metro);
    case "tram":
      return over(map.tram);
    case "bus":
      return over(map["bus-stops"]);
    case "buildings":
      return over(map.buildings);
    case "buildings-3d":
      return over(map["buildings-3d"]);
    case "shadows":
      return over(map.shadows);
    // Traffic takes the complement of each road; the main roads' stands for it
    case "traffic":
      return over(map["traffic-slow"], map["traffic-slow"].ramp?.[1]);
    case "lights":
      return over(map.lights);
  }
}
