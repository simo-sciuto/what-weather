import type { Camera, CameraPadding } from "@/types/atlas";

/**
 * How long the map must stay still, after a movement ends, before the point it rests on is asked for, in
 * milliseconds. Provisional (the user, 2026-10-14): a starting value to be tuned with people (spike S10), not a UX
 * decision. It runs from `moveend`, which already includes the map's inertia.
 */
export const QUIET_MS = 800;

/** The key the camera port adds to the event data of its own commands, to tell them from a person's moves */
export const CAMERA_ORIGIN_KEY = "atlasOrigin";

/**
 * Where the Atlas opens: Torino and the Alps behind it, a view of a region and not of a street. Free, from here on;
 * the product sets no limit to where the map goes (the engine's own remain).
 */
export const ATLAS_START: Camera = { lng: 7.687, lat: 45.07, zoom: 8, pitch: 0, bearing: 0 };

/**
 * The sky the Atlas wears until a point's weather colours it (M5, phase A): a clear sky at the middle of the day,
 * `atmospherePalette` over the existing solar scale (0 is sunrise, 1 sunset). Nothing here is the weather of anywhere.
 */
export const ATLAS_LIGHT = 0.5;

/** Padding around the map's viewport; none in M3, so the map's centre is the centre of the screen */
export const ATLAS_PADDING: Required<CameraPadding> = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * The least time between two requests for a point, whatever the map does: a person who stops every second is still
 * asked for once in two (the trailing one wins). PROVISIONAL: the real cost of a fresh cell on the live provider was
 * never measured (the spike S5 and the quota, WTH-212), so this is a guard and not a budget.
 */
export const POINT_MIN_INTERVAL_MS = 2000;

/**
 * How local the sky's colour is, by zoom (M5, WTH-267): from far, the point's weather is only a tint over the neutral
 * Atlas sky (it says nothing of the region round it); from close, the sky is the point's own. Between the two zooms the
 * weight rises smoothly. PROVISIONAL: the zooms and the far weight are a first guess for the user's eyes to judge.
 */
export const SKY_ZOOM_REGIONAL = 5;
export const SKY_ZOOM_LOCAL = 10;
export const SKY_FAR_WEIGHT = 0.3;

/** How long a point's weather may take before the Atlas calls it failed and offers "Riprova" */
export const POINT_TIMEOUT_MS = 10_000;
