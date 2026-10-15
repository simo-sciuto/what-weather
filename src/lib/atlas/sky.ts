import { SKY_FAR_WEIGHT, SKY_ZOOM_LOCAL, SKY_ZOOM_REGIONAL } from "@/constants/atlas";
import type { AtlasPoint, PointSky } from "@/types/atlas";
import type { MapVisualState } from "@/types/palette";

/**
 * The sky the Atlas wears (M5, phase A, WTH-267): the neutral Atlas sky and the sky of the point on show, mixed by the
 * zoom. With no point, or from far, it is mostly the neutral one; from close, the point's own. The point is the one the
 * map last rested on and loaded, never the camera's centre, so nothing here follows a frame of a movement.
 */

type Rgba = [number, number, number, number];

/** `#rrggbb`, `rgb(r g b / a)` and `rgba(r, g, b, a)`: the three forms the palette writes; null for any other */
function parseColor(value: string): Rgba | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)).concat(1) as Rgba;
  const fn = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[/,]\s*([\d.]+%?))?\s*\)$/i.exec(value.trim());
  if (!fn) return null;
  const alpha = fn[4] === undefined ? 1 : fn[4].endsWith("%") ? parseFloat(fn[4]) / 100 : parseFloat(fn[4]);
  return [Number(fn[1]), Number(fn[2]), Number(fn[3]), alpha];
}

const hex2 = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");

/** `a` at t = 0, `b` at t = 1, the channels and the alpha mixed on their own (not premultiplied: a small error for two veils of very different alpha); a colour it cannot read is `b` from the middle on, never a broken value */
export function mixColor(a: string, b: string, t: number): string {
  const [x, y] = [parseColor(a), parseColor(b)];
  if (!x || !y) return t >= 0.5 ? b : a;
  const c = x.map((v, i) => v + (y[i] - v) * t);
  return c[3] >= 0.9995 ? `#${hex2(c[0])}${hex2(c[1])}${hex2(c[2])}` : `rgb(${Math.round(c[0])} ${Math.round(c[1])} ${Math.round(c[2])} / ${c[3].toFixed(3)})`;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** How much of the point's sky the Atlas wears at `zoom`: `SKY_FAR_WEIGHT` from far, 1 from close, smooth between */
export function skyWeight(zoom: number): number {
  const t = Math.min(1, Math.max(0, (zoom - SKY_ZOOM_REGIONAL) / (SKY_ZOOM_LOCAL - SKY_ZOOM_REGIONAL)));
  return SKY_FAR_WEIGHT + (1 - SKY_FAR_WEIGHT) * smooth(t);
}

const mixAir = (a: MapVisualState, b: MapVisualState, t: number): MapVisualState =>
  Object.fromEntries((Object.keys(a) as (keyof MapVisualState)[]).map((k) => [k, a[k] + (b[k] - a[k]) * t])) as MapVisualState;

/** The sky for a point seen from `zoom`, over `base` (the neutral Atlas sky); `base` itself when there is no point */
export function skyFor(point: Pick<AtlasPoint, "sky"> | null, zoom: number, base: PointSky): PointSky {
  if (!point) return base;
  const w = skyWeight(zoom);
  const m = (k: "sky1" | "sky2" | "sky3" | "glass" | "glow" | "sun" | "cloud") => mixColor(base[k], point.sky[k], w);
  return { sky1: m("sky1"), sky2: m("sky2"), sky3: m("sky3"), glass: m("glass"), glow: m("glow"), sun: m("sun"), cloud: m("cloud"), air: mixAir(base.air, point.sky.air, w) };
}
