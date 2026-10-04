/**
 * Temperature as colour, on an absolute scale: 25° is the same warm tint in any
 * week and any place, so a glance at the bars says "warm" before the numbers.
 * The page's pastels, at one lightness so no step shouts: lilac cold,
 * periwinkle, aqua, sage, butter mild, apricot warm, rose hot.
 */

import { scaleChroma } from "./palette";

const STOPS: [number, [number, number, number]][] = [
  [-10, [211, 190, 250]],
  [0, [191, 203, 254]],
  [10, [156, 224, 247]],
  [17, [165, 233, 202]],
  [23, [249, 232, 167]],
  [29, [254, 200, 156]],
  [36, [254, 184, 193]],
];

function tempRgb(t: number): [number, number, number] {
  const [first] = STOPS;
  const last = STOPS[STOPS.length - 1];
  if (t <= first[0]) return [...first[1]];
  if (t >= last[0]) return [...last[1]];
  const j = STOPS.findIndex(([at]) => at >= t);
  const [a, ca] = STOPS[j - 1];
  const [b, cb] = STOPS[j];
  const f = (t - a) / (b - a);
  return ca.map((v, i) => Math.round(v + (cb[i] - v) * f)) as [number, number, number];
}

/**
 * The absolute scale: the colour of a temperature, the same in any place and week. For everything that
 * carries the number (the figures, the day's range, the week's bars, the poster's temperature), which must stay
 * comparable; never weathered.
 */
export function tempColor(t: number): string {
  return `rgb(${tempRgb(t).join(" ")})`;
}

/**
 * The temperature's colour as an accent over the scene (WTH-046I): the same hue and lightness as the absolute
 * scale, its chroma following the weather's saturation (`MapVisualState.saturation`: a little richer under a clear
 * sky, quieter in rain, quietest in snow), so an ornament of the page is not more colourful than the scene it sits
 * in. At saturation 1 it is `tempColor` exactly. Only for decoration (the country's name, the page's marker, the
 * compass needle), never for the figures: those use `tempColor`.
 */
export function tempAccent(t: number, saturation: number): string {
  // No weather to follow (a missing or non-numeric saturation) is the scale itself, never an invalid colour
  if (saturation === 1 || !Number.isFinite(saturation)) return tempColor(t);
  return `rgb(${scaleChroma(tempRgb(t), Math.min(1.15, Math.max(0.5, saturation))).join(" ")})`;
}

/** A left-to-right gradient covering temperatures `lo`..`hi`, with the scale's own stops in between. */
export function tempGradient(lo: number, hi: number): string {
  if (hi <= lo) return tempColor(lo);
  const inner = STOPS.filter(([at]) => at > lo && at < hi).map(([at]) => `${tempColor(at)} ${(((at - lo) / (hi - lo)) * 100).toFixed(1)}%`);
  return `linear-gradient(90deg, ${[`${tempColor(lo)} 0%`, ...inner, `${tempColor(hi)} 100%`].join(", ")})`;
}
