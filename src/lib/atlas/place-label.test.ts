import { describe, expect, it } from "vitest";
import type { PlaceNames } from "@/types/atlas";
import { placeLabel } from "./place-label";

/* ADR-024: the name of the place by zoom. Pure. */

const TORINO: PlaceNames = { country: "Italia", region: "città metropolitana di Torino", place: "Torino", locality: "Borgo Vanchiglia", nearKm: 0.3 };

describe("the name the zoom asks for", () => {
  it("is the country from far, then the region, the town, and from close the quarter", () => {
    expect(placeLabel(TORINO, 3)?.name).toBe("Italia");
    expect(placeLabel(TORINO, 5)?.name).toBe("città metropolitana di Torino");
    expect(placeLabel(TORINO, 8)?.name).toBe("città metropolitana di Torino");
    expect(placeLabel(TORINO, 9)?.name).toBe("Torino");
    expect(placeLabel(TORINO, 10.75)?.name).toBe("Torino");
    expect(placeLabel(TORINO, 11)?.name).toBe("Borgo Vanchiglia");
    expect(placeLabel(TORINO, 18)?.name).toBe("Borgo Vanchiglia");
  });

  it("only gets more precise as the map comes close, never less", () => {
    const depth = (z: number) => Object.values(TORINO).indexOf(placeLabel(TORINO, z)!.name);
    let last = -1;
    for (let z = 0; z <= 20; z += 0.25) {
      expect(depth(z)).toBeGreaterThanOrEqual(last);
      last = depth(z);
    }
  });

  it("puts the coarser places after it, nearest first, as its context", () => {
    expect(placeLabel(TORINO, 9)).toMatchObject({ context: "città metropolitana di Torino, Italia" });
    expect(placeLabel(TORINO, 11)).toMatchObject({ context: "Torino, città metropolitana di Torino" });
    expect(placeLabel(TORINO, 3)?.context).toBeNull();
  });

  it("falls back to the finest level it has when the zoom asks for one it does not know", () => {
    expect(placeLabel({ country: "Italia", place: "Courmayeur" }, 12)?.name).toBe("Courmayeur");
    expect(placeLabel({ country: "Italia", place: "Courmayeur" }, 6)?.name).toBe("Italia");
    expect(placeLabel({ country: "Italia" }, 14)?.name).toBe("Italia");
  });

  it("says nothing where it knows nothing", () => {
    expect(placeLabel(null, 10)).toBeNull();
    expect(placeLabel({}, 10)).toBeNull();
  });

  it("calls a name `near` only for the town and the quarter, and only when the cell is far from them", () => {
    const far: PlaceNames = { country: "Italia", region: "Valle d'Aosta", place: "Courmayeur", nearKm: 7.5 };
    expect(placeLabel(far, 10)?.near).toBe(true);
    expect(placeLabel(far, 6)?.near).toBe(false);
    expect(placeLabel(far, 3)?.near).toBe(false);
    expect(placeLabel({ ...far, nearKm: 4.9 }, 10)?.near).toBe(false);
    expect(placeLabel({ ...far, nearKm: undefined }, 10)?.near).toBe(false);
  });
});
