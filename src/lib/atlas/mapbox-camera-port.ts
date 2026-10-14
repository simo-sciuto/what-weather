import type { Map as MapboxMap } from "mapbox-gl";
import { CAMERA_ORIGIN_KEY } from "@/constants/atlas";
import type { Camera, CameraEvent, CameraOrigin, CameraPort, CameraTarget } from "@/types/atlas";

/**
 * The Mapbox map seen as a `CameraPort` (ADR-020). Its commands move the camera with event data that marks them as the
 * code's own; every event it passes on says whether the person or the code moved the map, read from that data.
 * `originalEvent` cannot tell: a drag and a key carry it, a wheel zoom does not (M0, S7), and any move not made through
 * this port, a `jumpTo` straight on the map, counts as the person's.
 *
 * It listens to the map only while somebody listens to it, and to `move`, which fires every frame, only for a listener
 * that asks for frames. It imports Mapbox for its types only: nothing here loads the library.
 */

/** What the adapter uses of a map; a `mapboxgl.Map` has all of it */
export type CameraMap = Pick<
  MapboxMap,
  "getCenter" | "getZoom" | "getPitch" | "getBearing" | "getPadding" | "jumpTo" | "easeTo" | "flyTo" | "setPadding" | "on" | "off"
>;

export type MapboxCameraPort = CameraPort & { dispose: () => void };

const PROGRAM = { [CAMERA_ORIGIN_KEY]: "program" } as const;

export function createMapboxCameraPort(map: CameraMap): MapboxCameraPort {
  type Entry = { listener: (event: CameraEvent) => void; frames: boolean };
  const entries = new Set<Entry>();

  const read = (): Camera => {
    const center = map.getCenter();
    return { lng: center.lng, lat: center.lat, zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() };
  };
  const originOf = (e: unknown): CameraOrigin =>
    (e as Record<string, unknown> | null)?.[CAMERA_ORIGIN_KEY] === "program" ? "program" : "user";

  const emit = (type: CameraEvent["type"], e: unknown) => {
    const event: CameraEvent = { type, camera: read(), origin: originOf(e) };
    for (const entry of [...entries]) if (type !== "move" || entry.frames) entry.listener(event);
  };
  const onStart = (e: unknown) => emit("movestart", e);
  const onEnd = (e: unknown) => emit("moveend", e);
  const onMove = (e: unknown) => emit("move", e);

  let attached = false;
  let framesAttached = false;
  function sync() {
    const wantEnds = entries.size > 0;
    if (wantEnds && !attached) {
      map.on("movestart", onStart);
      map.on("moveend", onEnd);
      attached = true;
    } else if (!wantEnds && attached) {
      map.off("movestart", onStart);
      map.off("moveend", onEnd);
      attached = false;
    }
    const wantFrames = [...entries].some((x) => x.frames);
    if (wantFrames && !framesAttached) {
      map.on("move", onMove);
      framesAttached = true;
    } else if (!wantFrames && framesAttached) {
      map.off("move", onMove);
      framesAttached = false;
    }
  }

  /** A target as Mapbox's options: a centre needs both coordinates, so a missing one is the camera's own */
  function optionsOf(target: CameraTarget) {
    const options: { center?: [number, number]; zoom?: number; pitch?: number; bearing?: number } = {};
    if (target.lng !== undefined || target.lat !== undefined) {
      const center = map.getCenter();
      options.center = [target.lng ?? center.lng, target.lat ?? center.lat];
    }
    if (target.zoom !== undefined) options.zoom = target.zoom;
    if (target.pitch !== undefined) options.pitch = target.pitch;
    if (target.bearing !== undefined) options.bearing = target.bearing;
    return options;
  }

  const jumpTo: CameraPort["jumpTo"] = (target) => {
    map.jumpTo(optionsOf(target), PROGRAM);
  };

  return {
    subscribe(listener, options) {
      const entry: Entry = { listener, frames: options?.frames === true };
      entries.add(entry);
      sync();
      return () => {
        entries.delete(entry);
        sync();
      };
    },
    get: read,
    jumpTo,
    easeTo(target, options) {
      if (options?.reducedMotion) return jumpTo(target);
      map.easeTo({ ...optionsOf(target), ...(options?.durationMs !== undefined ? { duration: options.durationMs } : {}) }, PROGRAM);
    },
    flyTo(target, options) {
      if (options?.reducedMotion) return jumpTo(target);
      map.flyTo({ ...optionsOf(target), ...(options?.durationMs !== undefined ? { duration: options.durationMs } : {}) }, PROGRAM);
    },
    setPadding(padding) {
      map.setPadding({ ...map.getPadding(), ...padding }, PROGRAM);
    },
    dispose() {
      entries.clear();
      sync();
    },
  };
}
