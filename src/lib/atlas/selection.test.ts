import { describe, expect, it, vi } from "vitest";
import { createSelectionStore, peakOf } from "./selection";

describe("the selection", () => {
  it("reads a summit from the map's natural labels, with its height when given", () => {
    expect(peakOf({ name: "Rocciamelone", elevation_m: 3538, maki: "mountain" }, 7.07, 45.2)).toEqual({ kind: "peak", name: "Rocciamelone", ele: 3538, lat: 45.2, lon: 7.07 });
    expect(peakOf({ name: "Punta X", elevation_m: "2100" }, 7, 45)?.ele).toBe(2100);
    expect(peakOf({ name: "Senza quota" }, 7, 45)?.ele).toBeNull();
    expect(peakOf({ elevation_m: 3000 }, 7, 45)).toBeNull();
  });

  it("tells its listeners when it changes", () => {
    const store = createSelectionStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.set(null);
    expect(listener).not.toHaveBeenCalled();
    store.set({ kind: "peak", name: "Monviso", ele: 3841, lat: 44.67, lon: 7.09 });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
