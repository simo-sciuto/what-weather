import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BASE_ZOOM,
  DESCENT_SCREENS,
  currentView,
  phoneMap,
  scrollProgress,
  END_PITCH,
  END_ZOOM,
  bearingName,
  bearingPoint,
  pitchAt,
  zoomAt,
} from "./map-view";

describe("zoomAt", () => {
  it("runs from the whole city at the top of the page to the streets at the bottom", () => {
    expect(zoomAt(0)).toBe(BASE_ZOOM);
    expect(zoomAt(1)).toBe(END_ZOOM);
  });

  it("eases in: slow at first, then quicker, quickest at the end", () => {
    const steps = [0, 0.25, 0.5, 0.75, 1].map(zoomAt);
    const gains = steps.slice(1).map((z, i) => z - steps[i]);
    // Each quarter of the page descends further than the one before
    for (let i = 1; i < gains.length; i++)
      expect(gains[i]).toBeGreaterThan(gains[i - 1]);
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
    for (let i = 1; i < pitches.length; i++)
      expect(pitches[i]).toBeGreaterThanOrEqual(pitches[i - 1]);
  });
});

describe("bearingPoint", () => {
  it("names the nearest of the eight points, by their Italian initials", () => {
    expect([0, 44, 90, 135, 180, 225, 270, 315].map(bearingPoint)).toEqual([
      "N",
      "NE",
      "E",
      "SE",
      "S",
      "SO",
      "O",
      "NO",
    ]);
  });

  it("wraps round: a negative or a full turn lands on the same point", () => {
    expect(bearingPoint(-90)).toBe("O");
    expect(bearingPoint(360)).toBe("N");
    expect(bearingPoint(-20)).toBe("N");
    expect(bearingPoint(-30)).toBe("NO");
    expect(bearingName(45)).toBe("Nord-Est");
  });
});

/** A page as the view reads it: a computer or a phone, scrolled to `scrollY`, of `scrollHeight` px on a `innerHeight` screen */
function stubPage({ scrollY, scrollHeight, innerHeight = 900, phone = false }: { scrollY: number; scrollHeight: number; innerHeight?: number; phone?: boolean }) {
  vi.stubGlobal("window", {
    scrollY,
    innerHeight,
    matchMedia: (q: string) => ({ matches: phone && q.includes("64rem") }),
  });
  vi.stubGlobal("document", { documentElement: { scrollHeight } });
}

describe("scrollProgress (WTH-241)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    phoneMap.set({ progress: 0, bearing: 0 });
  });

  it("does not depend on the page's length: opening Dettagli leaves the view where it was at the same scroll", () => {
    // The closed page, then the same scroll with the details open and the page far longer
    stubPage({ scrollY: 300, scrollHeight: 1627 });
    const closed = currentView();
    stubPage({ scrollY: 300, scrollHeight: 2568 });
    expect(currentView()).toEqual(closed);
    stubPage({ scrollY: 300, scrollHeight: 9000 });
    expect(currentView()).toEqual(closed);
  });

  it("is continuous and monotone with the scroll, and rests at the streets once the descent is done", () => {
    const ys = Array.from({ length: 41 }, (_, i) => i * 40);
    const ps = ys.map((y) => {
      stubPage({ scrollY: y, scrollHeight: 2568 });
      return scrollProgress();
    });
    for (let i = 1; i < ps.length; i++) {
      expect(ps[i]).toBeGreaterThanOrEqual(ps[i - 1]);
      // No step is larger than the scroll between two samples over the range
      expect(ps[i] - ps[i - 1]).toBeLessThanOrEqual(40 / (900 * DESCENT_SCREENS) + 1e-9);
    }
    expect(ps[0]).toBe(0);
    expect(ps[ps.length - 1]).toBe(1);
  });

  it("reaches the streets within the screen it is measured on, with the closed page's pace kept", () => {
    stubPage({ scrollY: DESCENT_SCREENS * 900, scrollHeight: 2181 });
    expect(scrollProgress()).toBeCloseTo(1, 10);
    // The closed pages measured: the descent of the old page ended after 1.42 (Torino) and 1.53 (Milano) screens
    for (const screens of [1.42, 1.53]) {
      stubPage({ scrollY: screens * 900, scrollHeight: 2181 });
      expect(scrollProgress()).toBeCloseTo(Math.min(1, screens / DESCENT_SCREENS), 2);
    }
  });

  it("follows the screen, not the page, when the window is resized", () => {
    stubPage({ scrollY: 360, scrollHeight: 2000, innerHeight: 900 });
    const onSmall = scrollProgress();
    stubPage({ scrollY: 360, scrollHeight: 2000, innerHeight: 450 });
    expect(scrollProgress()).toBeGreaterThan(onSmall);
  });

  it("leaves the phone alone: its map is moved by the finger, not the scroll", () => {
    stubPage({ scrollY: 0, scrollHeight: 900, phone: true });
    phoneMap.set({ progress: 0.5, bearing: 30 });
    const view = currentView();
    stubPage({ scrollY: 5000, scrollHeight: 9000, phone: true });
    expect(currentView()).toEqual(view);
  });
});

