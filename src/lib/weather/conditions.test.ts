import { describe, expect, it } from "vitest";
import { CONDITION_NAMES } from "@/constants/labels";
import type { Condition } from "@/types/weather";
import { isWet, precipNoun } from "./conditions";

const ALL = Object.keys(CONDITION_NAMES) as Condition[];

describe("what a sky brings", () => {
  it("is wet for drizzle, rain, thunderstorm and snow, and dry for the rest", () => {
    expect(ALL.filter(isWet).sort()).toEqual(["drizzle", "rain", "snow", "thunderstorm"]);
  });

  it("names what falls: snow, or rain when it is not snow", () => {
    expect(precipNoun(true)).toBe("Neve");
    expect(precipNoun(false)).toBe("Pioggia");
  });

  it("gives every sky its name, one word each, the nouns the interface reads", () => {
    expect(CONDITION_NAMES).toEqual({
      clear: "Sereno",
      "partly-cloudy": "Poco nuvoloso",
      cloudy: "Nuvoloso",
      fog: "Nebbia",
      drizzle: "Pioviggine",
      rain: "Pioggia",
      thunderstorm: "Temporale",
      snow: "Neve",
    });
  });
});
