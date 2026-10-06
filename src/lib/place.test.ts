import { describe, expect, it } from "vitest";
import { parsePlaceRef, placeHref, territoryHref } from "./place";

const como = { lat: 45.8081, lon: 9.0852, name: "Como", region: "Lombardia", country: "IT" };

describe("a place in the address", () => {
  it("opens the Territorio page with the same place as the weather page", () => {
    const query = (href: string) => Object.fromEntries(new URL(href, "http://x").searchParams);
    expect(territoryHref(como).startsWith("/territorio?")).toBe(true);
    expect(placeHref(como).startsWith("/?")).toBe(true);
    expect(query(territoryHref(como))).toEqual(query(placeHref(como)));
  });

  it("reads back what it wrote, whichever page it was written for", () => {
    for (const href of [placeHref(como), territoryHref(como)]) {
      const read = parsePlaceRef(Object.fromEntries(new URL(href, "http://x").searchParams));
      expect(read).toMatchObject({ lat: 45.8081, lon: 9.0852, name: "Como", region: "Lombardia", country: "IT" });
    }
  });

  it("keeps a name with spaces and accents whole", () => {
    const place = { lat: 46.5, lon: 11.35, name: "Sant'Antonio di Mavignola" };
    const read = parsePlaceRef(Object.fromEntries(new URL(territoryHref(place), "http://x").searchParams));
    expect(read?.name).toBe(place.name);
  });
});
