import { DAY_SECONDS } from "@/constants/time";
import { toDegrees, toRadians } from "@/utils/math";
/**
 * Where the sun is in the sky, from the time and the place alone: the
 * low-precision formulas of the Astronomical Almanac, good to a fraction of a
 * degree, which is far more than a drawn shadow needs.
 */

export type SunPosition = {
  /** Degrees clockwise from north (90 is east, 180 south) */
  azimuth: number;
  /** Degrees above the horizon; negative once it has set */
  altitude: number;
};


/** `time` is Unix seconds, as everywhere in the forecast. */
export function sunPosition(time: number, lat: number, lon: number): SunPosition {
  // Days since the year 2000's noon
  const n = time / DAY_SECONDS + 2440587.5 - 2451545;
  const anomaly = toRadians(357.529 + 0.98560028 * n);
  const longitude = toRadians(280.459 + 0.98564736 * n + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly));
  const tilt = toRadians(23.439 - 0.00000036 * n);
  const ascension = Math.atan2(Math.cos(tilt) * Math.sin(longitude), Math.cos(longitude));
  const declination = Math.asin(Math.sin(tilt) * Math.sin(longitude));
  // The hour angle: how far past the meridian the sun is
  const hour = toRadians(280.46061837 + 360.98564736629 * n + lon) - ascension;
  const phi = toRadians(lat);
  const altitude = Math.asin(Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hour));
  // Measured from the south by the formula; turned to count from the north
  const azimuth = Math.atan2(Math.sin(hour), Math.cos(hour) * Math.sin(phi) - Math.tan(declination) * Math.cos(phi)) + Math.PI;
  return { azimuth: (toDegrees(azimuth) + 360) % 360, altitude: toDegrees(altitude) };
}
