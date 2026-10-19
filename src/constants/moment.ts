import { HOUR_SECONDS } from "./time";

/**
 * How far an instant may be from the hour that answers it. Frames sit on whole hours (the first on the provider's
 * reading), so half an hour either way gives every instant inside the forecast an answering frame, and none
 * outside it.
 */
export const INSTANT_TOLERANCE_SECONDS = HOUR_SECONDS / 2;

/** How often the clock of "Adesso" ticks, in milliseconds: a minute, so the shown hour changes within a minute of the hour. */
export const NOW_TICK_MS = 60_000;

/**
 * The Unix seconds an instant may hold to be taken for a moment (after 2001, before 2100): a stray number in an address
 * or in storage is not read as one (ADR-028).
 */
export const MIN_INSTANT = 1_000_000_000;
export const MAX_INSTANT = 4_102_444_800;
