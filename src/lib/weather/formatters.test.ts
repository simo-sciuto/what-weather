import { describe, expect, it } from "vitest";
import { conditionLabel, placeSubtitle, spokenTime, tempDigits, type Preposition } from "./formatters";
import { regionName } from "./regions";
import { offsetToZone } from "@/lib/api/providers/openweather-transformers";

const TZ = "Europe/Rome";
/** A moment on 28 September 2026 in Rome (UTC+2 in summer time). */
const at = (h: number, m = 0) => Date.UTC(2026, 8, 28, h - 2, m) / 1000;

describe("spokenTime", () => {
  it.each<[number, number, Preposition, string]>([
    [17, 0, "verso le", "verso le 17"],
    [9, 30, "alle", "alle 9:30"],
    [14, 0, "tra le", "tra le 14"],
    [18, 0, "e le", "e le 18"],
    // "l’una", elided, never "le 1"
    [1, 0, "alle", "all’una"],
    [1, 0, "verso le", "verso l’una"],
    [1, 15, "fino alle", "fino all’1:15"],
    // Midnight and noon by name, with the bare preposition
    [0, 0, "dalle", "da mezzanotte"],
    [0, 0, "fino alle", "fino a mezzanotte"],
    [12, 0, "verso le", "verso mezzogiorno"],
  ])("%i:%i with “%s” → %s", (h, m, prep, expected) => {
    expect(spokenTime(at(h, m), TZ, prep)).toBe(expected);
  });
});

describe("conditionLabel", () => {
  it("scales precipitation with feminine adjectives", () => {
    expect(conditionLabel({ condition: "rain", intensity: "light" })).toBe("Pioggia debole");
    expect(conditionLabel({ condition: "snow", intensity: "heavy" })).toBe("Neve forte");
    expect(conditionLabel({ condition: "drizzle", intensity: "moderate" })).toBe("Pioviggine");
  });
  it("tells overcast from cloudy by cover", () => {
    expect(conditionLabel({ condition: "cloudy", intensity: "moderate", cloudCover: 95 })).toBe("Coperto");
    expect(conditionLabel({ condition: "cloudy", intensity: "moderate", cloudCover: 70 })).toBe("Nuvoloso");
  });
});

describe("tempDigits", () => {
  it("never shows a negative zero, and uses a real minus sign", () => {
    expect(tempDigits(-0.3)).toBe("0");
    expect(tempDigits(-3.6)).toBe("−4");
    expect(tempDigits(21.5)).toBe("22");
  });
});

describe("places in Italian", () => {
  it("translates regions, including ones saved earlier in English", () => {
    expect(regionName("Lombardy")).toBe("Lombardia");
    expect(regionName("Aosta Valley")).toBe("Valle d’Aosta");
    expect(regionName("Bavaria")).toBe("Baviera");
    expect(regionName("Somewhere Else")).toBe("Somewhere Else");
    expect(placeSubtitle({ name: "Milano", region: "Lombardy", country: "IT", lat: 45.46, lon: 9.19 })).toBe(
      "Lombardia, Italia",
    );
  });
});

describe("offsetToZone", () => {
  it("gives whole hours as IANA names that every Node accepts", () => {
    expect(offsetToZone(7200)).toBe("Etc/GMT-2");
    expect(offsetToZone(-18000)).toBe("Etc/GMT+5");
    expect(offsetToZone(0)).toBe("UTC");
    expect(() => new Intl.DateTimeFormat("it-IT", { timeZone: offsetToZone(7200) })).not.toThrow();
  });
  it("keeps half hours as an offset", () => {
    expect(offsetToZone(19800)).toBe("+05:30");
  });
});
