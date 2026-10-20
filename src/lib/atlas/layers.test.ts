import { describe, expect, it } from "vitest";
import { FIELD_OPACITY } from "@/constants/atlas";
import { inRegion, layerPlan, readLayer, withLayer } from "./layers";

describe("the Atlas's layers", () => {
  it("reads the layer from the address, Meteo for none or for anything else", () => {
    expect(readLayer("")).toBe("meteo");
    expect(readLayer("?strato=territorio")).toBe("territorio");
    expect(readLayer("strato=percorsi&lat=45")).toBe("percorsi");
    expect(readLayer("?strato=satellite")).toBe("meteo");
  });

  it("writes the layer into the address, and Meteo takes it out, keeping the rest", () => {
    expect(withLayer("lat=45.07&lon=7.69", "territorio")).toBe("lat=45.07&lon=7.69&strato=territorio");
    expect(withLayer("lat=45.07&strato=percorsi&t=1", "meteo")).toBe("lat=45.07&t=1");
  });

  it("Meteo is the viewer's own map under the field at full strength; the others quiet the field and draw their own", () => {
    expect(layerPlan("meteo", ["water", "traffic"])).toEqual({ options: ["water", "traffic"], fieldOpacity: FIELD_OPACITY, tintOpacity: expect.any(Number) });
    const land = layerPlan("territorio", ["traffic"]);
    expect(land.options).toEqual(expect.arrayContaining(["relief", "contours", "water"]));
    expect(land.options).not.toContain("traffic");
    expect(land.fieldOpacity).toBeLessThan(FIELD_OPACITY);
    expect(layerPlan("percorsi", []).options).toContain("relief");
  });

  it("knows the region: Torino, Aosta and Nizza are in it, Roma and Milano's east are not", () => {
    expect(inRegion(45.07, 7.69)).toBe(true);
    expect(inRegion(45.74, 7.32)).toBe(true);
    expect(inRegion(43.7, 7.27)).toBe(true);
    expect(inRegion(41.9, 12.5)).toBe(false);
    expect(inRegion(45.5, 10.2)).toBe(false);
  });
});
