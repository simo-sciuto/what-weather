/**
 * How far the map behind the page has come into the city, from where the page
 * is scrolled to. One place for it, so the backdrop that draws it and the
 * poster that is made from it can't disagree about what the viewer is looking at.
 */

/** The zoom at the top of the page, the whole city in view */
export const BASE_ZOOM = 11;

/** Where the page's whole scroll ends: down among the streets */
export const END_ZOOM = 16;

/**
 * The descent's pace. The zoom eases in: it hardly moves at the top, quickens
 * as the page goes down and is fastest at the end, so the city seems to fall
 * towards the reader, and tilts to lie back at the end (see `pitchAt`).
 */
const ZOOM_EASE = 2.2;

/** How far down the page is, 0 at the top to 1 at the bottom. */
export function scrollProgress(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
}

/** How far the map tips over at the bottom of the page, in degrees, and where in the scroll it starts to. */
export const END_PITCH = 60;
const PITCH_FROM = 0.12;

/** The map's zoom at a point of the scroll, 0 to 1. */
export function zoomAt(progress: number): number {
  return BASE_ZOOM + (END_ZOOM - BASE_ZOOM) * progress ** ZOOM_EASE;
}

/**
 * The map's tilt at a point of the scroll. It begins soon after the top of the page and turns smoothly
 * (a smoothstep, so it starts and ends gently), so the city lies back as the page arrives among its streets.
 */
export function pitchAt(progress: number): number {
  const t = Math.min(Math.max((progress - PITCH_FROM) / (1 - PITCH_FROM), 0), 1);
  return END_PITCH * t * t * (3 - 2 * t);
}

/** The view the map has at a point of the scroll. */
export function viewAt(progress: number): { zoom: number; pitch: number } {
  return { zoom: zoomAt(progress), pitch: pitchAt(progress) };
}

/** The view the viewer has the map at now; it stays at the top's, flat, for those who asked for less motion. */
export function currentView(): { zoom: number; pitch: number } {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return viewAt(0);
  return viewAt(scrollProgress());
}
