/** `value` held between `low` and `high` */
export const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** `value` held between 0 and 1 */
export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** From `a` to `b` by the fraction `f`; `f` is not held to 0..1 */
export const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

/** 0 up to `low`, 1 from `high`, and between them the smooth S of 3t^2 - 2t^3 */
export const smoothstep = (low: number, high: number, value: number) => {
  const t = clamp01((value - low) / (high - low));
  return t * t * (3 - 2 * t);
};

/** The remainder with the sign of the divisor: -90 mod 360 is 270 */
export const mod = (x: number, m: number) => ((x % m) + m) % m;

export const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
export const toDegrees = (radians: number) => (radians * 180) / Math.PI;
