/**
 * Temperature as pressure. One normalized value, three response curves: the type, the space and the map do not
 * move at the same rate.
 */
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (lo: number, hi: number, v: number) => {
  const t = clamp((v - lo) / (hi - lo), 0, 1);
  return t * t * (3 - 2 * t);
};

/** -20 °C is 0, 45 °C is 1 */
export function normTemp(tempC: number): number {
  return clamp((tempC + 20) / 65, 0, 1);
}

/** Scale and weight: flat in the cold, steep through the mild range, flat again in the heat */
export const typePressure = (t: number) => smoothstep(0.15, 0.95, t);
/** Empty space and the distance between groups: even all the way */
export const spaceCompression = (t: number) => t;
/** The map's crop: tightens early, so warm records are already close */
export const mapTightness = (t: number) => 1 - (1 - t) ** 2;

/** The crop's long side, in km: wide in the cold, tight in the heat */
export const CROP_KM = { wide: 420, tight: 90 } as const;
export const cropKm = (t: number) => lerp(CROP_KM.wide, CROP_KM.tight, mapTightness(t));
