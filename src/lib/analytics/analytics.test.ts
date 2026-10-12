import { afterEach, describe, expect, it, vi } from "vitest";
import { setAnalyticsSink, track, trackOnce } from "./analytics";

afterEach(() => setAnalyticsSink(null));

describe("analytics", () => {
  it("does nothing, and does not throw, with no sink connected", () => {
    expect(() => {
      track("explore");
      trackOnce("create_open");
    }).not.toThrow();
  });

  it("hands an event and its props to the sink", () => {
    const sink = vi.fn();
    setAnalyticsSink(sink);
    track("preview_done", { format: "print" });
    expect(sink).toHaveBeenCalledWith("preview_done", { format: "print" });
  });

  it("sends a once-event once per page load, and each event on its own", () => {
    const sink = vi.fn();
    setAnalyticsSink(sink);
    trackOnce("explore", { source: "scrub" });
    trackOnce("explore", { source: "day" });
    trackOnce("create_open");
    expect(sink.mock.calls).toEqual([["explore", { source: "scrub" }], ["create_open", undefined]]);
  });

  it("never lets a failing sink reach the page", () => {
    setAnalyticsSink(() => {
      throw new Error("down");
    });
    expect(() => track("explore")).not.toThrow();
  });
});
