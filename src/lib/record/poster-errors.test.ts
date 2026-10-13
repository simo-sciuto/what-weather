import { describe, expect, it } from "vitest";
import { POSTER_MESSAGES, PosterError, mapFailureOf, posterFailureOf, webglAvailable, type PosterFailure } from "./poster-errors";

const ALL: PosterFailure[] = ["map-unreachable", "map-unauthorized", "webgl", "timeout", "export"];

describe("the messages (WTH-235)", () => {
  it("retry only where a retry can help: a refused map and a device without WebGL are not retried", () => {
    expect(POSTER_MESSAGES["map-unreachable"].retry).toBe(true);
    expect(POSTER_MESSAGES.timeout.retry).toBe(true);
    expect(POSTER_MESSAGES.export.retry).toBe(true);
    expect(POSTER_MESSAGES["map-unauthorized"].retry).toBe(false);
    expect(POSTER_MESSAGES.webgl.retry).toBe(false);
  });

  it("say what happened in plain Italian, with no technical detail, token or address", () => {
    for (const f of ALL) {
      const m = POSTER_MESSAGES[f].message;
      expect(m.length).toBeGreaterThan(10);
      expect(m).not.toMatch(/token|api|http|error|mapbox|webgl2|status|\b40[13]\b|pk\./i);
    }
  });

  it("gives each cause its own sentence", () => {
    expect(new Set(ALL.map((f) => POSTER_MESSAGES[f].message)).size).toBe(ALL.length);
  });
});

describe("mapFailureOf: the cause of an error raised by the map", () => {
  it("an authorisation refusal is recognised by its HTTP status", () => {
    expect(mapFailureOf(Object.assign(new Error("Not Authorized"), { status: 401 }))).toBe("map-unauthorized");
    expect(mapFailureOf(Object.assign(new Error("Forbidden"), { status: 403 }))).toBe("map-unauthorized");
  });

  it("a network or server failure, and anything else the map raised, is the map being unreachable", () => {
    expect(mapFailureOf(new TypeError("Failed to fetch"))).toBe("map-unreachable");
    expect(mapFailureOf(Object.assign(new Error("Service unavailable"), { status: 503 }))).toBe("map-unreachable");
    expect(mapFailureOf(undefined)).toBe("map-unreachable");
    expect(mapFailureOf(new Error("Map failed"))).toBe("map-unreachable");
  });

  it("keeps the cause of a failure already classified", () => {
    expect(mapFailureOf(new PosterError("timeout"))).toBe("timeout");
  });
});

describe("posterFailureOf: the cause of any error in the pipeline", () => {
  it("keeps the causes the map gave", () => {
    for (const f of ["map-unreachable", "map-unauthorized", "webgl", "timeout"] as const) expect(posterFailureOf(new PosterError(f))).toBe(f);
  });

  it("is an export failure for anything from the last steps (canvas, encoding, fonts)", () => {
    expect(posterFailureOf(new Error("Canvas unavailable"))).toBe("export");
    expect(posterFailureOf(new Error("Export failed"))).toBe("export");
    expect(posterFailureOf("unknown")).toBe("export");
  });
});

describe("webglAvailable", () => {
  const canvas = (supported: Record<string, boolean>) => () => ({ getContext: (kind: string) => (supported[kind] ? {} : null) });

  it("is available with WebGL 2, or with WebGL 1 alone", () => {
    expect(webglAvailable(canvas({ webgl2: true }))).toBe(true);
    expect(webglAvailable(canvas({ webgl: true }))).toBe(true);
  });

  it("is not available when neither context is given: the map cannot be drawn", () => {
    expect(webglAvailable(canvas({}))).toBe(false);
  });
});
