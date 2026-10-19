import { isWet } from "@/lib/weather/conditions";
import { scaleChroma } from "@/lib/weather/palette";
import { tempColor } from "@/lib/weather/temp-color";
import type { Condition, Intensity } from "@/types/weather";
import { mixColor } from "./sky";

/**
 * The colour of one place in the weather field (WTH-272): the temperature's own colour from the page's scale (lilac when
 * cold, aqua and sage when mild, butter, apricot and rose as it warms), made greyer by cloud, darker and bluer by rain,
 * and dimmer at night. The temperature leads: Milano at 12 degrees and Roma at 19 are plainly two colours, by day and by
 * night, under the same sky. The atmosphere engine's own tone is not used here because at night it gives nearly one dark
 * colour to every overcast place, which is what the Atlas must not do. A reading of a model, never a measurement.
 */

export type FieldSample = { temp: number; cloudCover: number; precipitation: number; condition: Condition; intensity: Intensity; light: number };

/** What the night leaves of the colour: dim, but never so dark that the hue is lost */
const NIGHT_LEVEL = 0.58;
/** How much richer than the scale's pastels the field is drawn: it is a wash under a whole map, and the pastels would vanish */
const RICHNESS = 1.7;
/** The grey a cloud takes the colour towards, and the slate a rain does */
const CLOUD_GREY = "#8c97a3";
const RAIN_SLATE = "#33455c";

const finite = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const hex2 = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");

export function fieldColor(sample: FieldSample): string {
  const temp = finite(sample.temp, 15);
  const light = finite(sample.light, 0.5);
  const cloud = clamp01(finite(sample.cloudCover, 0) / 100);
  const wet = clamp01(Math.max(finite(sample.precipitation, 0) / 3, isWet(sample.condition) ? (sample.intensity === "heavy" ? 0.9 : sample.intensity === "light" ? 0.45 : 0.65) : 0));

  const pastel = (tempColor(temp).match(/\d+/g) ?? ["160", "200", "220"]).map(Number) as [number, number, number];
  const rich = scaleChroma(pastel, RICHNESS);
  let colour = `#${rich.map(hex2).join("")}`;
  colour = mixColor(colour, CLOUD_GREY, 0.6 * cloud);
  colour = mixColor(colour, RAIN_SLATE, 0.55 * wet);
  // the day's light: full from sunrise to sunset, the night's level before and after it
  const day = light > 0 && light < 1 ? clamp01(2 * Math.sin(Math.PI * light)) : 0;
  const level = NIGHT_LEVEL + (1 - NIGHT_LEVEL) * day;
  return mixColor("#000000", colour, level);
}
