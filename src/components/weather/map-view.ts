/**
 * How far the map behind the page has come into the city, from where the page
 * is scrolled to. One place for it, so the backdrop that draws it and the
 * poster that is made from it can't disagree about what the viewer is looking at.
 */

import { BASE_ZOOM } from "@/constants/map";

/** The zoom at the top of the page, the whole city in view */
export { BASE_ZOOM };

/** Where the page's whole scroll ends: down among the streets */
export const END_ZOOM = 16;

/**
 * The descent's pace. The zoom eases in: it hardly moves at the top, quickens
 * as the page goes down and is fastest at the end, so the city seems to fall
 * towards the reader, and tilts to lie back at the end (see `pitchAt`).
 */
const ZOOM_EASE = 2.2;

/**
 * How far the page has to scroll for the map to reach the streets, in screens. The descent is measured on the
 * screen, not on the page's length: the page grows and shrinks with what is open (the details, the week), and a
 * descent that depended on its length would move the map when a disclosure opened (WTH-241). 1.5 keeps the pace a
 * closed desktop page has, which is what the viewer sees first: once settled, that page is 2181 px (Torino) and
 * 2279 px (Milano, rain) tall on a 900 px screen, so its old descent ended after 1.42 and 1.53 screens.
 */
export const DESCENT_SCREENS = 1.5;

/** How far down the descent the page is, 0 at the top to 1 once the map has reached the streets, and resting there. */
export function scrollProgress(): number {
  const range = window.innerHeight * DESCENT_SCREENS;
  return range > 0 ? Math.min(Math.max(window.scrollY / range, 0), 1) : 0;
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
  const t = Math.min(
    Math.max((progress - PITCH_FROM) / (1 - PITCH_FROM), 0),
    1,
  );
  return END_PITCH * t * t * (3 - 2 * t);
}

/** The view the map has at a point of the scroll. */
export function viewAt(progress: number): { zoom: number; pitch: number } {
  return { zoom: zoomAt(progress), pitch: pitchAt(progress) };
}

/** A phone: the map stays at the top view (the finger moves it only in the Atlas); `phoneMap.progress` is only ever 0 there since the home became one page (ADR-028) */
export const isPhone = () => window.matchMedia("(width < 64rem)").matches;

/**
 * On a phone the page stays still and the finger moves the map instead: how far it has come down into
 * the city (0 to 1, as the scroll is on a computer) and how far it is turned (degrees). Kept here as a
 * small store, so the map behind the page and the poster made from it read the same.
 */
let phone = { progress: 0, bearing: 0 };
const phoneListeners = new Set<() => void>();
export const phoneMap = {
  get: () => phone,
  set(next: { progress: number; bearing: number }) {
    phone = next;
    phoneListeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    phoneListeners.add(listener);
    return () => phoneListeners.delete(listener);
  },
};

/**
 * The view the viewer has the map at now: on a computer from the scroll (the top's, flat, for those who
 * asked for less motion), on a phone from the finger.
 */
export function currentView(): {
  zoom: number;
  pitch: number;
  bearing: number;
} {
  if (isPhone()) return { ...viewAt(phone.progress), bearing: phone.bearing };
  // The turn is the viewer's on a computer too (dragged, or with the keys on the compass)
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return { ...viewAt(0), bearing: phone.bearing };
  return { ...viewAt(scrollProgress()), bearing: phone.bearing };
}

/** The eight points, from north clockwise, by their Italian initials */
const POINTS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"] as const;
const POINT_NAMES = [
  "Nord",
  "Nord-Est",
  "Est",
  "Sud-Est",
  "Sud",
  "Sud-Ovest",
  "Ovest",
  "Nord-Ovest",
] as const;

/** The nearest of the eight points to a bearing in degrees (0 north, clockwise): its initials ("NE", "SO") */
export function bearingPoint(bearing: number): (typeof POINTS)[number] {
  return POINTS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
}

/** The same in words ("Nord-Est"), for those who hear it */
export function bearingName(bearing: number): string {
  return POINT_NAMES[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
}
