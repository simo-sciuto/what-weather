/**
 * Temperature as colour, on an absolute scale: 25° is the same warm tint in any
 * week and any place, so a glance at the bars says "warm" before the numbers.
 * The page's pastels, at one lightness so no step shouts: lilac cold,
 * periwinkle, aqua, sage, butter mild, apricot warm, rose hot.
 */

const STOPS: [number, [number, number, number]][] = [
  [-10, [211, 190, 250]],
  [0, [191, 203, 254]],
  [10, [156, 224, 247]],
  [17, [165, 233, 202]],
  [23, [249, 232, 167]],
  [29, [254, 200, 156]],
  [36, [254, 184, 193]],
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
