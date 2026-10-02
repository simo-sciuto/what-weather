"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePhoneNav } from "../layout/PhoneNav";
import { isPhone, phoneMap } from "./map-view";

/** How far the finger travels to go all the way down into the city, in pixels: a short, light gesture */
const DESCENT_PX = 260;
/** How far the map turns for each pixel the finger goes sideways, in degrees */
const TURN_PER_PX = 0.35;
/** How far the finger must go before the gesture picks its direction */
const PICK_PX = 6;
/** How long "Ricentra" takes to bring the map back, in milliseconds */
const BACK_MS = 320;

/** What the finger may not move the map from: the controls, and the sheets and dialogs over it */
const NOT_MAP =
  "button, a, input, select, textarea, label, dialog, nav, [role=dialog], [id^=sheet-]";

/**
 * On a phone the page stays still and the finger moves the map behind it: up and down it comes down into
 * the city and back up (zooming in and tipping it, as scrolling does on a computer), quickly, a quarter of
 * the screen is the whole way; left and right it turns round the city. Only while no sheet is open, and
 * never from a control. "Ricentra" brings the map back to where it started. The layer it draws catches the
 * finger where nothing else is; the poster's reading over it lets it through (data-map-gestures).
 */
export function MapGestures() {
  const { page } = usePhoneNav();
  const view = useSyncExternalStore(
    phoneMap.subscribe,
    phoneMap.get,
    phoneMap.get,
  );
  const moved = view.progress > 0.005 || Math.abs(view.bearing) > 0.5;
  const back = useRef(0);

  useEffect(() => {
    if (page !== "poster") return;
    let start: {
      x: number;
      y: number;
      progress: number;
      bearing: number;
      axis: "y" | "x" | null;
    } | null = null;
    const down = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      const target = e.target as HTMLElement;
      if (target.closest(NOT_MAP)) return;
      // On a computer only a mouse, and only across the poster's own field: it turns the map, sideways
      if (
        !isPhone() &&
        (e.pointerType !== "mouse" ||
          e.button !== 0 ||
          !target.closest("[data-map-gestures]"))
      )
        return;
      cancelAnimationFrame(back.current);
      const now = phoneMap.get();
      start = {
        x: e.clientX,
        y: e.clientY,
        progress: now.progress,
        bearing: now.bearing,
        axis: null,
      };
    };
    const move = (e: PointerEvent) => {
      if (!start || !e.isPrimary) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!start.axis) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < PICK_PX) return;
        start.axis = !isPhone() || Math.abs(dy) < Math.abs(dx) ? "x" : "y";
      }
      const now = phoneMap.get();
      if (start.axis === "y") {
        // The finger going up takes the map down into the city, as scrolling down does
        phoneMap.set({
          ...now,
          progress: Math.min(1, Math.max(0, start.progress - dy / DESCENT_PX)),
        });
      } else {
        phoneMap.set({ ...now, bearing: start.bearing - dx * TURN_PER_PX });
      }
    };
    const up = () => {
      start = null;
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
    };
  }, [page]);

  const recentre = () => {
    const from = phoneMap.get();
    // The shorter way round
    const turn = ((((from.bearing + 180) % 360) + 360) % 360) - 180;
    const t0 = performance.now();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = (t: number) => {
      const k = still ? 1 : Math.min(1, (t - t0) / BACK_MS);
      const ease = 1 - (1 - k) ** 3;
      phoneMap.set({
        progress: from.progress * (1 - ease),
        bearing: turn * (1 - ease),
      });
      if (k < 1) back.current = requestAnimationFrame(step);
    };
    back.current = requestAnimationFrame(step);
  };

  return (
    <>
      {/* Catches the finger where nothing else is, above the map and under the page */}
      <div
        aria-hidden="true"
        data-map-gestures
        className="fixed inset-0 lg:hidden"
      />
      {moved && page === "poster" && (
        <button
          type="button"
          onClick={recentre}
          className="fixed right-[4.25rem] top-[max(1.25rem,calc(env(safe-area-inset-top)+0.375rem))] z-40 sm:right-[5.25rem] flex h-8 items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--sky-1)_28%,transparent)] px-3 text-[0.8125rem] font-medium text-ink shadow-[0_10px_28px_rgb(0_0_0/0.4),inset_0_1px_0_rgb(255_255_255/0.2)] backdrop-blur-2xl backdrop-saturate-[1.8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12a8 8 0 1 0 2.4-5.7" />
            <path d="M4 4v4h4" />
          </svg>
          Ricentra
        </button>
      )}
    </>
  );
}
