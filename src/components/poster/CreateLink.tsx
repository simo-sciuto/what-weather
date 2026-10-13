"use client";

import { createHref } from "@/lib/place";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePlace } from "../location/PlaceContext";
import { useMoment } from "../time/TimeContext";
import { BarTab, ICONS, usePhoneNav } from "../layout/PhoneNav";

/**
 * The way from the weather page to Create (ADR-018): "Crea" on a computer, a link to `/crea` with the place on
 * show. The poster itself is made there.
 */
export function CreateLink({ className = "" }: { className?: string }) {
  const { place } = usePlace();
  const href = createHref(place, useCreateMoment());
  return (
    <Link
      href={href}
      className={`group inline-flex items-baseline gap-3 text-left font-display text-[0.9375rem] sm:text-xl font-medium leading-none tracking-[-0.02em] transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent text-accent ${className}`}
    >
      Crea poster
      <span
        aria-hidden="true"
        className="font-sans text-base font-normal text-ink-muted transition-[transform,color] group-hover:translate-x-1 group-hover:text-accent"
      >
        →
      </span>
    </Link>
  );
}

/** The poster's tab in the phone's bar: away from the poster it goes back to it, on it it goes to Create */
export function CreateTab({ tabRef }: { tabRef: (el: HTMLButtonElement | null) => void }) {
  const nav = usePhoneNav();
  const { place } = usePlace();
  const moment = useCreateMoment();
  const router = useRouter();
  return (
    <BarTab
      label="Poster"
      hint={nav.page === "poster" ? "Poster: vai a Crea" : undefined}
      current={nav.page === "poster"}
      tabRef={tabRef}
      onClick={() => (nav.page === "poster" ? router.push(createHref(place, moment)) : nav.go("poster"))}
    >
      {ICONS.poster}
    </BarTab>
  );
}

/**
 * The moment on show, for Create (WTH-236): its instant when it is a forecast, nothing when it is the current
 * conditions (Create then opens on the current conditions too).
 */
function useCreateMoment(): number | undefined {
  const { frame, isLive } = useMoment();
  return isLive ? undefined : frame.time;
}
