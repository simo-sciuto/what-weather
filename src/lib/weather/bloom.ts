/**
 * The sun's glow as a soft bloom (WTH-179): where the light source sits, a halo that fades the way light
 * does, not a disc. Pure, so the poster's canvas and its test share it.
 *
 * The falloff is a Gaussian taken to zero exactly at the edge: it has no slope at the centre (no hot spot)
 * and no step at the rim (no visible edge), and every stop keeps the glow's own colour, only its alpha
 * moves (a fade to transparent black would darken a ring round the light).
 */

export type BloomStop = {
  /** 0 at the light, 1 at the rim */
  offset: number;
  /** The share of the glow's own alpha, 0..strength */
  share: number;
};

/** How tightly the light gathers round its source: higher is a smaller, quieter core in the same rim */
const TIGHTNESS = 3.2;
/** The most the centre gives of the glow's alpha: a bloom, not a lamp */
const STRENGTH = 0.8;

export function bloomStops(steps = 14): BloomStop[] {
  const edge = Math.exp(-TIGHTNESS);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return { offset: t, share: (STRENGTH * (Math.exp(-TIGHTNESS * t * t) - edge)) / (1 - edge) };
  });
}

/** The rim's distance from the light: the page's own, 42% of the way to the farthest corner. */
export function bloomRadius(W: number, H: number, x: number, y: number): number {
  const far = Math.max(Math.hypot(x, y), Math.hypot(W - x, y), Math.hypot(x, H - y), Math.hypot(W - x, H - y));
  return far * 0.42;
}

/** One stop's CSS colour: the glow's own channels, its alpha scaled by the stop's share. */
export function bloomColor([r, g, b, a]: [number, number, number, number], share: number): string {
  return `rgba(${r}, ${g}, ${b}, ${(a * share).toFixed(4)})`;
}

/** The channels of a palette's glow, `rgb(r g b / a)`; null if it is some other form. */
export function parseGlow(css: string): [number, number, number, number] | null {
  const m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[/,]\s*([\d.]+))?\s*\)$/.exec(css.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])] : null;
}
