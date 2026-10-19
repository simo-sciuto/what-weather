/**
 * A made-up network of roads for the film's map: smooth organic lines, drawn the same way every time (a seeded
 * generator, so the film never differs between two plays and a test can say what it is). Not any real place's roads.
 */

export type Pt = readonly [number, number];

/** A small seeded generator (mulberry32): the same seed, the same numbers */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A smooth SVG path through the points (a Catmull-Rom spline turned into cubic curves) */
export function smoothPath(points: readonly Pt[]): string {
  if (points.length < 2) return "";
  const f = (n: number) => n.toFixed(1);
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

export type Road = { d: string; weight: number; delay: number };

/**
 * `count` roads over a `width` by `height` frame: each one a meandering line from one edge region to another, the long
 * ones (the weight 1) drawn first and heavier, the small ones after. `delay` (0 to 1) is when each begins to draw.
 */
export function roadNetwork(seed: number, count: number, width: number, height: number): Road[] {
  const rnd = seeded(seed);
  const roads: Road[] = [];
  for (let i = 0; i < count; i++) {
    const main = i < count * 0.22;
    const steps = main ? 9 : 5 + Math.floor(rnd() * 3);
    let x = rnd() * width;
    let y = rnd() * height;
    let heading = rnd() * Math.PI * 2;
    const stride = main ? 150 : 70 + rnd() * 50;
    const pts: Pt[] = [[x, y]];
    for (let s = 0; s < steps; s++) {
      heading += (rnd() - 0.5) * (main ? 0.9 : 1.6);
      x += Math.cos(heading) * stride;
      y += Math.sin(heading) * stride;
      pts.push([x, y]);
    }
    roads.push({ d: smoothPath(pts), weight: main ? 1 : 0.5, delay: main ? (i / (count * 0.22)) * 0.4 : 0.25 + rnd() * 0.6 });
  }
  return roads;
}
