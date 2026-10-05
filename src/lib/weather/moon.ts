import { DAY_SECONDS } from "@/constants/time";
import { MOON_LABELS } from "@/constants/labels";
/**
 * Moon phase from astronomy rather than weather data, for providers that
 * don't report it. Mean synodic month from a reference new moon; accurate to
 * within a few hours, which is plenty for a phase name and illumination.
 */

const SYNODIC_MONTH_DAYS = 29.530588853;
/** New moon of 2000-01-06 18:14 UTC */
const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14) / 1000;

/** 0 and 1 = new moon, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter. */
export function moonPhaseAt(ts: number): number {
  const days = (ts - REFERENCE_NEW_MOON) / DAY_SECONDS;
  return (((days / SYNODIC_MONTH_DAYS) % 1) + 1) % 1;
}

/** Fraction of the disc that is lit, 0..1. */
export function illumination(phase: number): number {
  return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

export function phaseName(phase: number): string {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.0339 || p > 0.9661) return MOON_LABELS.newMoon;
  if (p < 0.2161) return "Luna crescente";
  if (p < 0.2839) return "Primo quarto";
  if (p < 0.4661) return "Gibbosa crescente";
  if (p < 0.5339) return MOON_LABELS.fullMoon;
  if (p < 0.7161) return "Gibbosa calante";
  if (p < 0.7839) return "Ultimo quarto";
  return "Luna calante";
}

/** Seconds until the phase next reaches `target` (e.g. 0.5 for full moon). */
export function secondsUntilPhase(phase: number, target: number): number {
  const delta = (((target - phase) % 1) + 1) % 1;
  return delta * SYNODIC_MONTH_DAYS * DAY_SECONDS;
}
