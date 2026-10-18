import { describe, expect, it } from "vitest";
import type { PlaceNames } from "@/types/atlas";
import { placeLabel, plainName } from "./place-label";

/* ADR-024: the name of the place by zoom. Pure. */

const TORINO: PlaceNames = { country: "Italia", region: "città metropolitana di Torino", place: "Torino", locality: "Borgo Vanchiglia", nearKm: 0.3 };

describe("the administrative words of a province", () => {
  it("are left off a title, and the name is kept when nothing else would be left", () => {
    expect(plainName("provincia autonoma di Bolzano")).toBe("Bolzano");
    expect(plainName("città metropolitana di Torino")).toBe("Torino");
    expect(plainName("Città Metropolitana di Reggio Calabria")).toBe("Reggio Calabria");
    expect(plainName("provincia di Caltanissetta")).toBe("Caltanissetta");
    expect(plainName("libero consorzio comunale di Enna")).toBe("Enna");
    expect(plainName("provincia dell'Aquila")).toBe("L'Aquila");
    expect(plainName("Valle d'Aosta")).toBe("Valle d'Aosta");
    expect(plainName("Lazio")).toBe("Lazio");
    expect(plainName("provincia di ")).toBe("provincia di ");
  });
});

describe("the name the zoom asks for", () => {
  it("is the country from far, then the region, the town, and from close the quarter", () => {
    expect(placeLabel(TORINO, 3)?.name).toBe("Italia");
    expect(placeLabel(TORINO, 5)?.name).toBe("Torino");
    expect(placeLabel(TORINO, 8)?.name).toBe("Torino");
    expect(placeLabel(TORINO, 9)?.name).toBe("Torino");
    expect(placeLabel(TORINO, 10.75)?.name).toBe("Torino");
    // from the quarter's zoom the title is the town, with the quarter under it
    expect(placeLabel(TORINO, 11)).toMatchObject({ name: "Torino", detail: "Borgo Vanchiglia" });
    expect(placeLabel(TORINO, 18)).toMatchObject({ name: "Torino", detail: "Borgo Vanchiglia" });
    expect(placeLabel(TORINO, 9)?.detail).toBeNull();
  });

  it("only gets more precise as the map comes close, never less", () => {
    const depth = (z: number) => {
      const l = placeLabel(TORINO, z)!;
      return Object.values(TORINO).indexOf(l.detail ?? l.name) + (l.detail ? 0.5 : 0);
    };
    let last = -1;
    for (let z = 0; z <= 20; z += 0.25) {
      expect(depth(z)).toBeGreaterThanOrEqual(last);
      last = depth(z);
    }
  });

  it("puts the coarser places after it, nearest first, as its context", () => {
    // the metropolitan city is the town's own name: it is not told twice
    expect(placeLabel(TORINO, 9)).toMatchObject({ context: "Italia" });
    expect(placeLabel(TORINO, 11)).toMatchObject({ context: "Italia" });
    expect(placeLabel({ country: "Italia", region: "Piemonte", place: "Torino" }, 9)).toMatchObject({ context: "Piemonte, Italia" });
    expect(placeLabel(TORINO, 3)?.context).toBeNull();
  });

  it("falls back to the finest level it has when the zoom asks for one it does not know", () => {
    expect(placeLabel({ country: "Italia", place: "Courmayeur" }, 12)).toMatchObject({ name: "Courmayeur", detail: null });
    expect(placeLabel({ country: "Italia", locality: "Les Praz" }, 12)).toMatchObject({ name: "Les Praz", detail: null });
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
    expect(placeLabel({ ...far, locality: "Entrèves" }, 12)).toMatchObject({ name: "Courmayeur", detail: "Entrèves", near: true });
    expect(placeLabel({ ...far, nearKm: undefined }, 10)?.near).toBe(false);
  });
});
