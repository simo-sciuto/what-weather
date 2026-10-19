"use client";

import { STATIONS, stationTitleId, type StationId } from "../bar/stations";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * One station of the page (ADR-028): a section with its number and name, a one-line sentence of what it is for, and a
 * hairline above. It enters once, rising 16 px, when it comes up to a quarter of the screen from the foot (M03):
 * an IntersectionObserver, not scroll-driven animation (Safari). A station already in view when the page opens, and
 * everything for a person who asked for less motion, is simply there. The attribute is set on the element itself, so
 * the server's markup is the finished page and a browser without scripts loses nothing.
 */
export function Station({ id, children }: { id: StationId; children: ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const { number, label, sentence } = STATIONS.find((s) => s.id === id)!;

  useEffect(() => {
    const el = section.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.75) return;
    el.dataset.enter = "waiting";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.dataset.enter = "done";
        io.disconnect();
      },
      { rootMargin: "0px 0px -25% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      delete el.dataset.enter;
    };
  }, []);

  return (
    <section
      ref={section}
      id={id}
      aria-labelledby={stationTitleId(id)}
      data-station={id}
      className="station scroll-mt-16 border-t border-white/50 pb-12 pt-3 lg:scroll-mt-6"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={stationTitleId(id)} tabIndex={-1} className="label text-ink! focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
          {number} · {label}
        </h2>
        <p className="label text-right">{sentence}</p>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
