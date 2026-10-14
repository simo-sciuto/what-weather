/**
 * How long the map must stay still, after a movement ends, before the point it rests on is asked for, in
 * milliseconds. Provisional (the user, 2026-10-14): a starting value to be tuned with people (spike S10), not a UX
 * decision. It runs from `moveend`, which already includes the map's inertia.
 */
export const QUIET_MS = 800;

/** The key the camera port adds to the event data of its own commands, to tell them from a person's moves */
export const CAMERA_ORIGIN_KEY = "atlasOrigin";
