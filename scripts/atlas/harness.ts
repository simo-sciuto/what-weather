/**
 * Runs in Chromium (see camera-harness.mjs): a real Mapbox GL map over an empty style, the camera port and the settle
 * controller of the Atlas wired together, and a log of everything they say. Nothing here reaches a service: the page
 * is served locally and every other address is refused by the driver.
 */
import { createMapboxCameraPort } from "@/lib/atlas/mapbox-camera-port";
import { createSettleController } from "@/lib/atlas/settle-controller";
import type { AtlasStatus, CameraEvent, CommitRequest } from "@/types/atlas";

type Mapbox = typeof import("mapbox-gl").default;

/** What the driver reads and calls: everything is plain data, so it crosses into the page and back */
export type AtlasHarness = ReturnType<typeof start>;

function start(quietMs: number) {
  const gl = (window as unknown as { mapboxgl: Mapbox }).mapboxgl;
  gl.accessToken = "pk.unused-nothing-is-requested";
  const map = new gl.Map({
    container: "map",
    style: { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#345" } }] },
    center: [7.687, 45.07],
    zoom: 9,
    attributionControl: false,
    trackResize: false,
  });
  const t0 = performance.now();
  const now = () => Math.round(performance.now() - t0);

  const port = createMapboxCameraPort(map);
  const events: (CameraEvent & { t: number })[] = [];
  const raw: { type: string; t: number; hasOriginalEvent: boolean }[] = [];
  const commits: { t: number; seq: number; reason: string; cell: { lat: number; lon: number }; aborted: () => boolean }[] = [];
  const statuses: (AtlasStatus & { t: number })[] = [];

  const controller = createSettleController({
    quietMs,
    onCommit(request: CommitRequest) {
      commits.push({ t: now(), seq: request.seq, reason: request.reason, cell: request.cell, aborted: () => request.signal.aborted });
      // The owner of a real Atlas would fetch; here the weather arrives quickly and well
      setTimeout(() => controller.resolve(request.seq, { ok: true }), 40);
    },
  });
  controller.subscribe((s) => statuses.push({ ...s, t: now() }));
  port.subscribe((e) => {
    events.push({ ...e, t: now() });
    controller.onCamera(e);
  });
  // The map's own events as they are, to compare with what the port says of them
  for (const type of ["movestart", "moveend"] as const) {
    map.on(type, (e) => raw.push({ type, t: now(), hasOriginalEvent: !!(e as { originalEvent?: unknown }).originalEvent }));
  }

  let frameCount = 0;
  let rawMoves = 0;
  map.on("move", () => rawMoves++);
  let stopFrames: (() => void) | null = null;

  const snapshot = () => ({
    t: now(),
    phase: controller.getStatus().phase,
    status: controller.getStatus(),
    commits: commits.map(({ t, seq, reason, cell }) => ({ t, seq, reason, cell })),
    aborted: commits.map((c) => c.aborted()),
    events: events.slice(),
    raw: raw.slice(),
    statusChanges: statuses.length,
  });
  const reset = () => {
    events.length = 0;
    raw.length = 0;
    commits.length = 0;
    statuses.length = 0;
  };

  return {
    loaded: new Promise<void>((resolve) => map.once("load", () => resolve())),
    snapshot,
    reset,
    jumpTo: () => port.jumpTo({ lng: 7.8, lat: 45.1 }),
    /** A long flight, for the person to interrupt */
    flyLong: () => port.flyTo({ lng: 9.5, lat: 45.6, zoom: 8 }, { durationMs: 1500 }),
    phase: () => controller.getStatus().phase,
    command: (name: "jumpTo" | "easeTo" | "flyTo" | "setPadding") => {
      const target = { lng: 8.2, lat: 45.3, zoom: 10 };
      if (name === "setPadding") port.setPadding({ bottom: 120 });
      else if (name === "jumpTo") port.jumpTo(target);
      else if (name === "easeTo") port.easeTo(target, { durationMs: 200 });
      else port.flyTo(target, { durationMs: 200 });
    },
    /** 30 commands one frame apart, as the home page's backdrop moves its camera */
    jumpEveryFrame: async () => {
      for (let i = 0; i < 30; i++) {
        port.jumpTo({ bearing: i });
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
    },
    /** A move straight on the map, not through the port: untagged */
    untaggedJump: () => map.jumpTo({ center: [8.5, 45.2] }),
    center: () => port.get(),
    resetCamera: () => port.jumpTo({ lng: 7.687, lat: 45.07, zoom: 9, bearing: 0, pitch: 0 }),
    focus: () => map.getCanvas().focus(),
    /** A listener that asks for the frames of a movement, and how many it has heard */
    framesListener: (on: boolean) => {
      if (on && !stopFrames) stopFrames = port.subscribe((e) => e.type === "move" && frameCount++, { frames: true });
      if (!on && stopFrames) {
        stopFrames();
        stopFrames = null;
      }
    },
    framesHeard: () => ({ port: frameCount, map: rawMoves }),
    dispose: () => port.dispose(),
    controllerDispose: () => controller.dispose(),
  };
}

(window as unknown as { startAtlas: typeof start }).startAtlas = start;
