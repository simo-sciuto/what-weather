/**
 * The clock of the explainer, "Come funziona": one number, the time in milliseconds, from which every scene works out
 * what it shows. Nothing is a CSS animation that runs on its own: a scene is a pure function of the time, so the film can
 * be paused, jumped to any step, played again and tested at any moment. The shape of it (the scenes, their lengths) is here.
 */

export type SceneId = "intro" | "explore" | "create" | "keep" | "outro";

export type Scene = { id: SceneId; from: number; to: number };

/** The guide in five parts, in milliseconds: a quick opening of three words, the three steps (Explore, Create, Keep), a short close with the way in */
export const SCENES: readonly Scene[] = [
  { id: "intro", from: 0, to: 2400 },
  { id: "explore", from: 2400, to: 7000 },
  { id: "create", from: 7000, to: 11800 },
  { id: "keep", from: 11800, to: 16000 },
  { id: "outro", from: 16000, to: 18400 },
];

export const DURATION = SCENES[SCENES.length - 1].to;

/** The three steps the person can jump to, with where each begins */
export const STEPS = [
  { id: "explore", label: "Explore", caption: "Scopro un luogo", from: SCENES[1].from, to: SCENES[1].to },
  { id: "create", label: "Create", caption: "Creo un record", from: SCENES[2].from, to: SCENES[2].to },
  { id: "keep", label: "Keep", caption: "Conservo il risultato", from: SCENES[3].from, to: SCENES[3].to },
] as const;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** How far through `[from, to]` a time is, 0 before it and 1 after it */
export const span = (t: number, from: number, to: number) => clamp01((t - from) / (to - from));

/** Easings: the film's movement is slow to start and slow to land, never linear */
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
export const easeOutQuart = (t: number) => 1 - (1 - t) ** 4;
export const easeInOutQuart = (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);
/** A small overshoot on arrival: a thing that lands, settles */
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

/** The scene a time falls in, and how far through it */
export function sceneAt(t: number): { scene: Scene; progress: number } {
  const time = Math.min(Math.max(t, 0), DURATION);
  const scene = SCENES.find((s) => time < s.to) ?? SCENES[SCENES.length - 1];
  return { scene, progress: span(time, scene.from, scene.to) };
}

/** Which of the three steps is on: 0 Explore, 1 Create, 2 Keep; -1 in the opening and the close */
export function stepAt(t: number): number {
  const id = sceneAt(t).scene.id;
  return STEPS.findIndex((s) => s.id === id);
}

/** A whole number counting up to `value`, as a figure that climbs while it is eased in */
export const countTo = (value: number, progress: number) => Math.round(value * easeOutCubic(clamp01(progress)));

/** Where a point is on a path of waypoints, 0 to 1 along it, easing through each leg */
export function along(points: readonly (readonly [number, number])[], progress: number): [number, number] {
  const legs = points.length - 1;
  const p = clamp01(progress) * legs;
  const i = Math.min(legs - 1, Math.floor(p));
  const t = easeInOutCubic(p - i);
  const [a, b] = [points[i], points[i + 1]];
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}
