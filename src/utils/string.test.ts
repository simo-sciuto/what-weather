import { describe, expect, it } from "vitest";
import { capitalize, slug } from "./string";

describe("string utils", () => {
  it("capitalizes the first letter and leaves the rest", () => {
    expect(capitalize("mercoledì")).toBe("Mercoledì");
    expect(capitalize("già Maiuscolo")).toBe("Già Maiuscolo");
    expect(capitalize("")).toBe("");
  });

  it("makes a file name part: no accents, no spaces, single hyphens, none at the ends", () => {
    expect(slug("Reykjavík")).toBe("reykjavik");
    expect(slug("Stampa A")).toBe("stampa-a");
    expect(slug("Storia 9:16")).toBe("storia-9-16");
    expect(slug("  São Paulo!! ")).toBe("sao-paulo");
    expect(slug("---")).toBe("");
  });
});
