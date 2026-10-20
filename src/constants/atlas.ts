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

/**
 * The flight to a city the person searched for (WTH-274): it starts as soon as the search is chosen, arcs out and in
 * (Mapbox's `flyTo`), and lands at a zoom where the town is named but not its quarter. Its length follows the distance
 * between `FLIGHT_MIN_MS` and `FLIGHT_MAX_MS`. PROVISIONAL, for the user's eyes.
 */
export const SEARCH_ZOOM = 10.5;
export const FLIGHT_MIN_MS = 1400;
export const FLIGHT_MAX_MS = 4200;

/**
 * The weather field across the map (WTH-272): the colour of the weather of many places at once, drawn under the map's
 * lines and fading from one place to the next. One request asks Open-Meteo for a lattice of points over what is in view;
 * the lattice sits on a fixed grid of whole steps (so the same view, and its neighbours, share one cache entry) and
 * never has more than `FIELD_MAX_POINTS` points (each point is one call on Open-Meteo's meter). PROVISIONAL: the cap,
 * the steps, the opacities and the colours' richness are first guesses for the user's eyes, and the quota
 * is undecided (WTH-212, WTH-269).
 */
export const FIELD_MAX_POINTS = 48;
/** The steps a lattice may have, in degrees, from fine to coarse: the finest is about the resolution of the models */
export const FIELD_STEPS = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64] as const;
/** How opaque the field is under the map's lines: the sky of the page shows through a little, and while it is not there */
export const FIELD_OPACITY = 0.9;
/** How strongly the same colours are laid over the map's own lines and water, so the roads and the sea take the colour of the weather of the place they are in */
export const FIELD_TINT_OPACITY = 0.38;

/** How many days of hours the weather field carries (WTH-345): as far as a verdict is ever given (ARCHITECTURE.md section 5) */
export const FIELD_FORECAST_DAYS = 3;
/** The pixels of the image the field is drawn into: the map stretches it, smoothly, over what is in view */
export const FIELD_IMAGE = { width: 192, height: 144 } as const;


/** How long the time bar must rest before the moment is written into the address (WTH-343): a link opens on it, a drag does not rewrite the address at every hour */
export const MOMENT_ADDRESS_DELAY_MS = 400;
