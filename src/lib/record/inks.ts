import { computeAtmosphere } from "@/lib/weather/visual-input";
import { atmospherePalette, inkOverSky } from "@/lib/weather/palette";
import { tempColor } from "@/lib/weather/temp-color";
import type { InkRole, RecordInput } from "./types";

/** The type's ink: a warm paper white, the same on every record */
export const INK_1 = "#f3efe6";

/**
 * Swiss Flat's four inks from the existing palette system, never a colour of its own: the paper is the sky of
 * the moment flattened to one tone (`atmospherePalette`'s middle stop), the second ink is the map's water over
 * it, the accent is the temperature on the absolute scale (ADR-012, `tempColor`), used once.
 */
export function recordInks(r: RecordInput): Record<InkRole, string> {
  const light = r.light ?? 0.5;
  const { atmosphere } = computeAtmosphere({
    light,
    temp: r.temp,
    condition: r.condition,
    intensity: r.intensity,
    cloudCover: r.cloudCover,
    humidity: r.humidity,
    visibility: r.visibility,
    precipitation: r.precipitation,
    uvIndex: r.uv,
  });
  const p = atmospherePalette(light, atmosphere);
  // The water a shade deeper than the paper, halfway to the map's own water; never lighter than the paper, so a
  // storm's bright water does not become a second accent
  const water = mix(p.sky2, inkOverSky(p.sky2, p.map.water), 0.6);
  return {
    paper: p.sky2,
    "ink-1": INK_1,
    "ink-2": luminance(water) < luminance(p.sky2) ? water : mix(p.sky2, "#000000", 0.22),
    accent: tempColor(r.temp),
  };
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
function mix(a: string, b: string, t: number): string {
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}
