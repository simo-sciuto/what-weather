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

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** `time` is Unix seconds, as everywhere in the forecast. */
export function sunPosition(time: number, lat: number, lon: number): SunPosition {
  // Days since the year 2000's noon
  const n = time / 86400 + 2440587.5 - 2451545;
  const anomaly = rad(357.529 + 0.98560028 * n);
  const longitude = rad(280.459 + 0.98564736 * n + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly));
  const tilt = rad(23.439 - 0.00000036 * n);
  const ascension = Math.atan2(Math.cos(tilt) * Math.sin(longitude), Math.cos(longitude));
  const declination = Math.asin(Math.sin(tilt) * Math.sin(longitude));
  // The hour angle: how far past the meridian the sun is
  const hour = rad(280.46061837 + 360.98564736629 * n + lon) - ascension;
  const phi = rad(lat);
  const altitude = Math.asin(Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hour));
  // Measured from the south by the formula; turned to count from the north
  const azimuth = Math.atan2(Math.sin(hour), Math.cos(hour) * Math.sin(phi) - Math.tan(declination) * Math.cos(phi)) + Math.PI;
  return { azimuth: (deg(azimuth) + 360) % 360, altitude: deg(altitude) };
}
