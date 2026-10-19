import { describe, expect, it } from "vitest";
import { createMockProvider } from "@/lib/api/providers/mock";
import { buildTimeline } from "./frames";
import { needsNames, withPlaceNames } from "./place-names";

async function weather() {
  return createMockProvider("clear", "13:00").getByCoords(45.46, 9.19);
}

describe("withPlaceNames: the link's names put on the weather of the coordinates, after the cache (ADR-029)", () => {
  it("without a name the weather is returned as it is", async () => {
    const data = await weather();
    expect(withPlaceNames(data, undefined, "Lombardia", "IT", null)).toBe(data);
  });

  it("the name replaces the provider's; region and country come from the link first", async () => {
    const data = await weather();
    const named = withPlaceNames(data, "Torino", "Piemonte", "IT", { region: "X", country: "YY" });
    expect(named.place).toMatchObject({ name: "Torino", region: "Piemonte", country: "IT" });
    expect(named.place.lat).toBe(data.place.lat);
  });

  it("what the link lacks is completed by the place search, then by the provider", async () => {
    const data = await weather();
    expect(withPlaceNames(data, "Torino", undefined, undefined, { region: "Piemonte", country: "IT" }).place).toMatchObject({
      region: "Piemonte",
      country: "IT",
    });
    const kept = withPlaceNames(data, "Torino", undefined, undefined, null);
    expect(kept.place.region).toBe(data.place.region);
    expect(kept.place.country).toBe(data.place.country);
  });

  it("does not change the weather it was given", async () => {
    const data = await weather();
    const before = JSON.stringify(data);
    withPlaceNames(data, "Torino", "Piemonte", "IT", null);
    expect(JSON.stringify(data)).toBe(before);
  });
});

describe("needsNames: when the place search is asked", () => {
  it("only for a name that lacks its region or its country", () => {
    expect(needsNames("Torino", undefined, undefined)).toBe(true);
    expect(needsNames("Torino", "Piemonte", undefined)).toBe(true);
    expect(needsNames("Torino", "Piemonte", "IT")).toBe(false);
    expect(needsNames(undefined, undefined, undefined)).toBe(false);
    expect(needsNames("", undefined, undefined)).toBe(false);
  });
});

describe("the timeline does not read the place's names, so it can stay in the cache without them", () => {
  it("is the same with a link's name as without", async () => {
    const data = await weather();
    const named = withPlaceNames(data, "Un altro nome", "Un'altra regione", "ZZ", null);
    expect(buildTimeline(named)).toEqual(buildTimeline(data));
  });
});
