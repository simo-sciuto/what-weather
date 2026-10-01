import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS, MAP_OPTIONS, isDefaultMapOptions, parseMapOptions } from "./map-options";

describe("parseMapOptions", () => {
  it("is the page's own when nothing is stored or what is stored is senseless", () => {
    for (const raw of ["", "not json", '{"green":true}', "42"]) {
      expect(parseMapOptions(raw)).toEqual([...DEFAULT_MAP_OPTIONS]);
    }
  });

  it("keeps an empty choice as it is: everything off is a choice, not a missing one", () => {
    expect(parseMapOptions("[]")).toEqual([]);
  });

  it("keeps only the options that exist, in their own order", () => {
    expect(parseMapOptions('["traffic","nonsense","green"]')).toEqual(["green", "traffic"]);
    expect(parseMapOptions(JSON.stringify(MAP_OPTIONS))).toEqual([...MAP_OPTIONS]);
  });
});

describe("isDefaultMapOptions", () => {
  it("recognises the page's own whatever the order, and nothing else", () => {
    expect(isDefaultMapOptions([...DEFAULT_MAP_OPTIONS].reverse())).toBe(true);
    expect(isDefaultMapOptions([])).toBe(false);
    expect(isDefaultMapOptions([...DEFAULT_MAP_OPTIONS, "green"])).toBe(false);
  });
});
