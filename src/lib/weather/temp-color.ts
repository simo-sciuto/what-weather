/**
 * Temperature as colour, on an absolute scale: 25° is the same peach in any
 * week and any place, so a glance at the bars says "warm" before the numbers.
 * Acid pastels: lilac cold, aqua, mint, lemon mild, peach warm, hot pink.
 */

const STOPS: [number, [number, number, number]][] = [
  [-10, [185, 168, 255]],
  [0, [143, 216, 255]],
  [10, [143, 255, 208]],
  [17, [230, 255, 143]],
  [23, [255, 224, 138]],
  [29, [255, 171, 143]],
  [36, [255, 143, 200]],
];

export function tempColor(t: number): string {
  const [first] = STOPS;
  const last = STOPS[STOPS.length - 1];
  if (t <= first[0]) return `rgb(${first[1].join(" ")})`;
  if (t >= last[0]) return `rgb(${last[1].join(" ")})`;
  const j = STOPS.findIndex(([at]) => at >= t);
  const [a, ca] = STOPS[j - 1];
  const [b, cb] = STOPS[j];
  const f = (t - a) / (b - a);
  return `rgb(${ca.map((v, i) => Math.round(v + (cb[i] - v) * f)).join(" ")})`;
}

/** A left-to-right gradient covering temperatures `lo`..`hi`, with the scale's own stops in between. */
export function tempGradient(lo: number, hi: number): string {
  if (hi <= lo) return tempColor(lo);
  const inner = STOPS.filter(([at]) => at > lo && at < hi).map(([at]) => `${tempColor(at)} ${(((at - lo) / (hi - lo)) * 100).toFixed(1)}%`);
  return `linear-gradient(90deg, ${[`${tempColor(lo)} 0%`, ...inner, `${tempColor(hi)} 100%`].join(", ")})`;
}
