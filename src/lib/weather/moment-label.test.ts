import { describe, expect, it } from "vitest";
import { momentDay, momentLabel, momentOrigin } from "./moment-label";

// Mon 19 Oct 2026, 11:05 UTC = 13:05 in Rome (CEST), 20:05 in Tokyo
const T = Date.UTC(2026, 9, 19, 11, 5) / 1000;

describe("the moment as the page writes it", () => {
  it("names the day and the hour on the place's own clock, with the place", () => {
    expect(momentLabel(T, "Europe/Rome", "Torino")).toBe("Lun 19 ott, 13:05, ora di Torino");
    expect(momentLabel(T, "Asia/Tokyo", "Tokyo")).toBe("Lun 19 ott, 20:05, ora di Tokyo");
  });

  it("takes the day from the place, not from the viewer", () => {
    // 23:30 UTC on the 19th is already the 20th in Tokyo
    const late = Date.UTC(2026, 9, 19, 23, 30) / 1000;
    expect(momentDay(late, "Europe/Rome")).toBe("Mar 20 ott"); // 01:30 on the 20th in Rome
    expect(momentDay(late, "Asia/Tokyo")).toBe("Mar 20 ott");
    expect(momentDay(late, "America/Los_Angeles")).toBe("Lun 19 ott");
  });

  it("says where the moment comes from, and never passes an estimate off as given", () => {
    expect(momentOrigin({ isLive: true, measured: true })).toBeNull();
    expect(momentOrigin({ isLive: false, measured: true })).toBe("previsione");
    expect(momentOrigin({ isLive: false, measured: false })).toBe("previsione stimata");
  });
});
