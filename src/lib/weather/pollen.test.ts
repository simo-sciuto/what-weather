import { describe, expect, it } from "vitest";
import { pollenInfo } from "./details";

/** Pollen by family: which are in the air, how high, and which one leads. */

const pollen = (tree: number, grass: number, weed: number) => ({ time: 0, tree, grass, weed });

describe("pollen", () => {
  it("is nothing to tell when there is less than a grain of each", () => {
    expect(pollenInfo(pollen(0, 0.5, 0.9))).toBeNull();
  });

  it("bands each family on its own scale, the highest first", () => {
    // 64 grains of grass are high; of trees they would be moderate
    const p = pollenInfo(pollen(64, 64, 2))!;
    expect(p.families.map((f) => `${f.name} ${f.label}`)).toEqual(["Graminacee Alto", "Alberi Moderato", "Erbe infestanti Basso"]);
    expect(p.label).toBe("Alto");
    expect(p.high).toBe(true);
  });

  it("leaves out a family that isn't in the air", () => {
    const p = pollenInfo(pollen(0, 0, 12))!;
    expect(p.families.map((f) => f.name)).toEqual(["Erbe infestanti"]);
    expect(p.label).toBe("Moderato");
    expect(p.high).toBe(false);
  });

  it("reaches very high", () => {
    expect(pollenInfo(pollen(1500, 0, 0))!.label).toBe("Molto alto");
  });
});
