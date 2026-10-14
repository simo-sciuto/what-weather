import { HOUR_SECONDS } from "./time";

/**
 * How far an instant may be from the hour that answers it. Frames sit on whole hours (the first on the provider's
 * reading), so half an hour either way gives every instant inside the forecast an answering frame, and none
 * outside it.
 */
export const INSTANT_TOLERANCE_SECONDS = HOUR_SECONDS / 2;

/** How often the clock of "Adesso" ticks, in milliseconds: a minute, so the shown hour changes within a minute of the hour. */
export const NOW_TICK_MS = 60_000;
