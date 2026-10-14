import { describe, expect, it, vi } from "vitest";
import { CAMERA_ORIGIN_KEY } from "@/constants/atlas";
import type { CameraEvent } from "@/types/atlas";
import { createMapboxCameraPort, type CameraMap } from "./mapbox-camera-port";

/*
 * ADR-020, M2: the adapter over a map that is not a map: just what it asks of one. The real Mapbox is exercised by
 * scripts/atlas/camera-harness.mjs (a browser, no service); here the logic of the adapter is held to account.
 */

type Handler = (e: object) => void;

function fakeMap() {
  const handlers = new Map<string, Set<Handler>>();
  const state = { lng: 7.69, lat: 45.07, zoom: 9, pitch: 10, bearing: 20, padding: { top: 0, right: 0, bottom: 0, left: 0 } };
  const calls: { name: string; args: unknown[] }[] = [];
  const map = {
    on: vi.fn((type: string, handler: Handler) => {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(handler);
    }),
    off: vi.fn((type: string, handler: Handler) => {
      handlers.get(type)?.delete(handler);
    }),
    getCenter: () => ({ lng: state.lng, lat: state.lat }),
    getZoom: () => state.zoom,
    getPitch: () => state.pitch,
    getBearing: () => state.bearing,
    getPadding: () => ({ ...state.padding }),
    jumpTo: vi.fn((...args: unknown[]) => calls.push({ name: "jumpTo", args })),
    easeTo: vi.fn((...args: unknown[]) => calls.push({ name: "easeTo", args })),
    flyTo: vi.fn((...args: unknown[]) => calls.push({ name: "flyTo", args })),
    setPadding: vi.fn((...args: unknown[]) => calls.push({ name: "setPadding", args })),
  };
  /** What Mapbox does: it fires an event whose data is the event data of the command, merged in */
  const fire = (type: string, data: object = {}) => handlers.get(type)?.forEach((h) => h({ type, ...data }));
  const listening = (type: string) => handlers.get(type)?.size ?? 0;
  return { map: map as unknown as CameraMap, raw: map, state, fire, listening, calls };
}

describe("the camera port over a map", () => {
  it("does not touch the map until somebody listens, and lets it go when nobody does", () => {
    const { map, raw, listening } = fakeMap();
    const port = createMapboxCameraPort(map);
    expect(raw.on).not.toHaveBeenCalled();
    const stop = port.subscribe(() => {});
    expect(listening("movestart")).toBe(1);
    expect(listening("moveend")).toBe(1);
    stop();
    expect(listening("movestart")).toBe(0);
    expect(listening("moveend")).toBe(0);
  });

  it("listens to the frames of a movement only for a listener that asks for them", () => {
    const { map, fire, listening } = fakeMap();
    const port = createMapboxCameraPort(map);
    const quiet = vi.fn();
    const stopQuiet = port.subscribe(quiet);
    expect(listening("move")).toBe(0);
    const frames = vi.fn();
    const stopFrames = port.subscribe(frames, { frames: true });
    expect(listening("move")).toBe(1);
    fire("move");
    expect(frames).toHaveBeenCalledTimes(1);
    expect(quiet).not.toHaveBeenCalled();
    stopFrames();
    expect(listening("move")).toBe(0);
    expect(listening("movestart")).toBe(1);
    stopQuiet();
  });

  it("reads the camera as it is when the event fires, and says who moved it", () => {
    const { map, fire, state } = fakeMap();
    const port = createMapboxCameraPort(map);
    const seen: CameraEvent[] = [];
    port.subscribe((e) => seen.push(e));
    fire("movestart");
    state.lng = 8.93;
    state.lat = 44.41;
    state.zoom = 11;
    fire("moveend");
    expect(seen).toEqual([
      { type: "movestart", origin: "user", camera: { lng: 7.69, lat: 45.07, zoom: 9, pitch: 10, bearing: 20 } },
      { type: "moveend", origin: "user", camera: { lng: 8.93, lat: 44.41, zoom: 11, pitch: 10, bearing: 20 } },
    ]);
  });

  it("calls a move the person's unless it carries the port's mark, whether or not it has an original event", () => {
    const { map, fire } = fakeMap();
    const port = createMapboxCameraPort(map);
    const origins: string[] = [];
    port.subscribe((e) => origins.push(e.origin));
    fire("movestart", { originalEvent: { type: "mousemove" } });
    fire("movestart"); // a wheel zoom: no original event
    fire("movestart", { [CAMERA_ORIGIN_KEY]: "program" });
    fire("movestart", { [CAMERA_ORIGIN_KEY]: "something else" });
    fire("movestart", { originalEvent: { type: "wheel" }, [CAMERA_ORIGIN_KEY]: "program" });
    expect(origins).toEqual(["user", "user", "program", "user", "program"]);
  });

  it("tells every listener, and one leaving does not silence another", () => {
    const { map, fire } = fakeMap();
    const port = createMapboxCameraPort(map);
    const a = vi.fn();
    const b = vi.fn();
    const stopA = port.subscribe(a);
    port.subscribe(b);
    fire("moveend");
    stopA();
    fire("moveend");
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it("marks every command as the code's own, in the event data", () => {
    const { map, raw } = fakeMap();
    const port = createMapboxCameraPort(map);
    port.jumpTo({ zoom: 12 });
    port.easeTo({ zoom: 12 });
    port.flyTo({ zoom: 12 });
    port.setPadding({ bottom: 100 });
    const mark = { [CAMERA_ORIGIN_KEY]: "program" };
    expect(raw.jumpTo.mock.calls[0][1]).toEqual(mark);
    expect(raw.easeTo.mock.calls[0][1]).toEqual(mark);
    expect(raw.flyTo.mock.calls[0][1]).toEqual(mark);
    expect(raw.setPadding.mock.calls[0][1]).toEqual(mark);
  });

  it("turns a target into Mapbox's options, leaving out what is not set and keeping a centre whole", () => {
    const { map, raw } = fakeMap();
    const port = createMapboxCameraPort(map);
    port.jumpTo({ zoom: 12, bearing: 40 });
    expect(raw.jumpTo.mock.calls[0][0]).toEqual({ zoom: 12, bearing: 40 });
    port.jumpTo({ lng: 8.9 });
    expect(raw.jumpTo.mock.calls[1][0]).toEqual({ center: [8.9, 45.07] });
    port.jumpTo({ lat: 44.4, lng: 8.9, pitch: 0 });
    expect(raw.jumpTo.mock.calls[2][0]).toEqual({ center: [8.9, 44.4], pitch: 0 });
  });

  it("asks for a duration only when given one, so Mapbox keeps its own", () => {
    const { map, raw } = fakeMap();
    const port = createMapboxCameraPort(map);
    port.easeTo({ zoom: 10 });
    expect("duration" in (raw.easeTo.mock.calls[0][0] as object)).toBe(false);
    port.flyTo({ zoom: 10 }, { durationMs: 900 });
    expect(raw.flyTo.mock.calls[0][0]).toEqual({ zoom: 10, duration: 900 });
  });

  it("jumps instead of easing or flying for a person who asked for less motion", () => {
    const { map, raw } = fakeMap();
    const port = createMapboxCameraPort(map);
    port.easeTo({ zoom: 10 }, { reducedMotion: true });
    port.flyTo({ zoom: 11 }, { reducedMotion: true });
    expect(raw.easeTo).not.toHaveBeenCalled();
    expect(raw.flyTo).not.toHaveBeenCalled();
    expect(raw.jumpTo.mock.calls.map((c) => c[0])).toEqual([{ zoom: 10 }, { zoom: 11 }]);
    expect(raw.jumpTo.mock.calls[0][1]).toEqual({ [CAMERA_ORIGIN_KEY]: "program" });
  });

  it("changes only the sides of the padding it is given", () => {
    const { map, raw, state } = fakeMap();
    state.padding = { top: 10, right: 20, bottom: 30, left: 40 };
    const port = createMapboxCameraPort(map);
    port.setPadding({ bottom: 200 });
    expect(raw.setPadding.mock.calls[0][0]).toEqual({ top: 10, right: 20, bottom: 200, left: 40 });
  });

  it("lets go of the map when it is disposed, whoever is still listening", () => {
    const { map, listening } = fakeMap();
    const port = createMapboxCameraPort(map);
    port.subscribe(() => {}, { frames: true });
    port.subscribe(() => {});
    port.dispose();
    expect(listening("movestart") + listening("moveend") + listening("move")).toBe(0);
  });
});
