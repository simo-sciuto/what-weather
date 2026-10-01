import { describe, expect, it } from "vitest";
import { BASE_ZOOM, END_PITCH, END_ZOOM, pitchAt, zoomAt } from "./map-view";

describe("zoomAt", () => {
  it("runs from the whole city at the top of the page to the streets at the bottom", () => {
    expect(zoomAt(0)).toBe(BASE_ZOOM);
    expect(zoomAt(1)).toBe(END_ZOOM);
  });

  it("eases in: slow at first, then quicker, quickest at the end", () => {
    const steps = [0, 0.25, 0.5, 0.75, 1].map(zoomAt);
    const gains = steps.slice(1).map((z, i) => z - steps[i]);
    // Each quarter of the page descends further than the one before
    for (let i = 1; i < gains.length; i++) expect(gains[i]).toBeGreaterThan(gains[i - 1]);
    // The first quarter covers well under a quarter of the way
    expect(gains[0]).toBeLessThan((END_ZOOM - BASE_ZOOM) * 0.1);
  });
});

describe("pitchAt", () => {
  it("is flat only at the very top, already tipping well before the middle, and fully tipped at the end", () => {
    expect(pitchAt(0)).toBe(0);
    expect(pitchAt(0.1)).toBe(0);
    expect(pitchAt(0.5)).toBeGreaterThan(END_PITCH / 4);
    expect(pitchAt(1)).toBe(END_PITCH);
  });

  it("turns smoothly, never backwards", () => {
    const pitches = Array.from({ length: 21 }, (_, i) => pitchAt(i / 20));
    for (let i = 1; i < pitches.length; i++) expect(pitches[i]).toBeGreaterThanOrEqual(pitches[i - 1]);
  });
});
