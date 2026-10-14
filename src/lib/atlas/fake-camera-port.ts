import type { Camera, CameraEvent, CameraOrigin, CameraPort, CameraTarget } from "@/types/atlas";

/**
 * A camera port with no map behind it, for tests (and the seam a map-less end-to-end test will need, WTH-230). The test
 * plays the person with `user`; the port's own commands move the camera at once as `program`.
 */
export type FakeCameraPort = CameraPort & {
  /** The person moves the map: `movestart`, then `moveend` at `to` unless the movement is left open */
  user: (to: CameraTarget, options?: { end?: boolean }) => void;
  /** One event, by hand */
  emit: (type: CameraEvent["type"], origin: CameraOrigin, patch?: CameraTarget) => void;
  /** How many listeners hear `move`, and how many hear anything */
  listenerCounts: () => { all: number; frames: number };
};

const START: Camera = { lng: 7.69, lat: 45.07, zoom: 9, pitch: 0, bearing: 0 };

export function createFakeCameraPort(initial: Camera = START): FakeCameraPort {
  let camera = { ...initial };
  const listeners = new Set<{ listener: (event: CameraEvent) => void; frames: boolean }>();

  const emit: FakeCameraPort["emit"] = (type, origin, patch) => {
    if (patch) camera = { ...camera, ...patch };
    const event: CameraEvent = { type, camera: { ...camera }, origin };
    for (const l of [...listeners]) if (type !== "move" || l.frames) l.listener(event);
  };
  const program = (target: CameraTarget) => {
    emit("movestart", "program");
    emit("moveend", "program", target);
  };

  return {
    subscribe(listener, options) {
      const entry = { listener, frames: options?.frames === true };
      listeners.add(entry);
      return () => {
        listeners.delete(entry);
      };
    },
    get: () => ({ ...camera }),
    jumpTo: (target) => program(target),
    easeTo: (target) => program(target),
    flyTo: (target) => program(target),
    setPadding: () => {
      emit("movestart", "program");
      emit("moveend", "program");
    },
    user(to, options) {
      emit("movestart", "user");
      emit("move", "user", to);
      if (options?.end !== false) emit("moveend", "user");
    },
    emit,
    listenerCounts: () => ({ all: listeners.size, frames: [...listeners].filter((l) => l.frames).length }),
  };
}
