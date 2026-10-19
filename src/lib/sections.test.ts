import { describe, expect, it } from "vitest";
import { createHref, placeHref } from "./place";
import { entryOf, journeyQuery, parseSection, sectionHash, sectionHref, sectionOf, sharedHref } from "./sections";

const torino = { lat: 45.0703, lon: 7.6869, name: "Torino", region: "Piemonte", country: "IT" };

describe("entryOf: the section a route opens on", () => {
  it("/ is Meteo, /atlas is Esplora, /crea is Crea, a trailing slash does not matter", () => {
    expect(entryOf("/")).toBe("meteo");
    expect(entryOf("/atlas")).toBe("esplora");
    expect(entryOf("/atlas/")).toBe("esplora");
    expect(entryOf("/crea")).toBe("crea");
  });

  it("anything else is Meteo", () => {
    expect(entryOf("/qualcosa")).toBe("meteo");
    expect(entryOf("")).toBe("meteo");
  });
});

describe("parseSection and sectionOf", () => {
  it("reads the three names, with or without the #, in any case", () => {
    expect(parseSection("#esplora")).toBe("esplora");
    expect(parseSection("crea")).toBe("crea");
    expect(parseSection("#METEO")).toBe("meteo");
  });

  it("anything that is not a section is null (an anchor from elsewhere is not a section)", () => {
    for (const h of ["", "#", "#conserva", "#chapter-hours", "#esplora2"]) expect(parseSection(h)).toBeNull();
  });

  it("a known hash wins over the route; otherwise the route's own section", () => {
    expect(sectionOf("/atlas", "#crea")).toBe("crea");
    expect(sectionOf("/", "#esplora")).toBe("esplora");
    expect(sectionOf("/atlas", "")).toBe("esplora");
    expect(sectionOf("/atlas", "#unknown")).toBe("esplora");
    expect(sectionOf("/", "")).toBe("meteo");
  });
});

describe("sectionHash and sectionHref: writing a section into the address", () => {
  it("Meteo on / is no hash", () => {
    expect(sectionHash("/", "meteo")).toBe("");
  });

  it("Meteo on an entry route is written, since no hash there would mean another section", () => {
    expect(sectionHash("/atlas", "meteo")).toBe("#meteo");
    expect(sectionHash("/crea", "meteo")).toBe("#meteo");
  });

  it("the other sections are always written", () => {
    expect(sectionHash("/", "esplora")).toBe("#esplora");
    expect(sectionHash("/atlas", "esplora")).toBe("#esplora");
    expect(sectionHash("/crea", "crea")).toBe("#crea");
  });

  it("a switch keeps the route and the query as they are and changes the hash alone", () => {
    expect(sectionHref("/", "lat=45.0703&lon=7.6869&t=1792418400", "crea")).toBe("/?lat=45.0703&lon=7.6869&t=1792418400#crea");
    expect(sectionHref("/atlas", "?lat=45.07", "crea")).toBe("/atlas?lat=45.07#crea");
    expect(sectionHref("/atlas", "", "meteo")).toBe("/atlas#meteo");
    expect(sectionHref("/", "", "meteo")).toBe("/");
  });

  it("what a switch writes is read back as the same section on the same route", () => {
    for (const path of ["/", "/atlas", "/crea"]) {
      for (const section of ["meteo", "esplora", "crea"] as const) {
        const href = sectionHref(path, "lat=1&lon=2", section);
        const hash = href.includes("#") ? href.slice(href.indexOf("#")) : "";
        expect(sectionOf(path, hash)).toBe(section);
      }
    }
  });
});

describe("journeyQuery and sharedHref: one precision for the place and the moment", () => {
  it("is what the weather page and Create already link with (four decimals, the names), so nothing moves", () => {
    expect(`/?${journeyQuery(torino)}`).toBe(placeHref(torino));
    expect(`/crea?${journeyQuery(torino)}`).toBe(createHref(torino));
  });

  it("carries the moment as its instant, and none for Adesso", () => {
    expect(journeyQuery(torino, 1792418400)).toBe(`${journeyQuery(torino)}&t=1792418400`);
    expect(journeyQuery(torino, null)).toBe(journeyQuery(torino));
    expect(journeyQuery(torino, undefined)).toBe(journeyQuery(torino));
  });

  it("a moment that is not a whole number of seconds is left out, never written as t=NaN", () => {
    expect(journeyQuery(torino, Number.NaN)).toBe(journeyQuery(torino));
    expect(journeyQuery(torino, 12.5)).toBe(journeyQuery(torino));
  });

  it("a cell (two decimals, no name) reads the same at four decimals", () => {
    expect(journeyQuery({ lat: 45.07, lon: 7.69 })).toBe("lat=45.0700&lon=7.6900");
  });

  it("a shared link is the canonical page with the section as a hash", () => {
    expect(sharedHref("meteo", torino)).toBe(placeHref(torino));
    expect(sharedHref("crea", torino, 1792418400)).toBe(`/?${journeyQuery(torino, 1792418400)}#crea`);
    expect(sharedHref("esplora", torino)).toMatch(/#esplora$/);
  });
});
