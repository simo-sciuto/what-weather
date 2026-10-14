import type { CameraPadding } from "@/types/atlas";

/**
 * The map's centre and the crosshair that marks it. With padding, the map's centre (`getCenter()`) is the geographic
 * point at the middle of what the padding leaves, not at the middle of the screen (M0, S7), so the crosshair sits there.
 */

/** How far from the middle of the screen the map's centre is, in pixels: right and down are positive */
export function centreOffset(padding: CameraPadding = {}): { x: number; y: number } {
  const { top = 0, right = 0, bottom = 0, left = 0 } = padding;
  return { x: (left - right) / 2, y: (top - bottom) / 2 };
}

/** The screen point of the map's centre, in the map's own pixels, for a map of `size` */
export function centrePoint(size: { width: number; height: number }, padding: CameraPadding = {}): { x: number; y: number } {
  const { x, y } = centreOffset(padding);
  return { x: size.width / 2 + x, y: size.height / 2 + y };
}

/**
 * "45,0700° N · 7,6870° E": the centre as the person reads it, to about ten metres (four decimals), the Italian way.
 * The longitude is brought into -180 to 180: the map may go round the world.
 */
export function formatCenter(lng: number, lat: number): string {
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180;
  const part = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(4).replace(".", ",")}° ${v >= 0 ? pos : neg}`;
  return `${part(lat, "N", "S")} · ${part(wrapped, "E", "O")}`;
}
