"use client";

import { atlasHref } from "@/lib/atlas/links";
import { createHref } from "@/lib/place";
import { formatTime } from "@/lib/weather/formatters";
import { useMemo, useState } from "react";
import { usePlace } from "../location/PlaceContext";
import { useMoment } from "../time/TimeContext";
import { HowItWorks } from "./HowItWorks";
import type { FilmCity } from "./Stage";
import { useGuide } from "./useGuide";

/**
 * The guide's hook into the page, in its foot: "Rivedi la guida" as plain text, and the film it opens. It plays by itself
 * the first time someone arrives (see useGuide) and whenever it is asked for. It is about the place on show. The film
 * is rewritten on the real stations later (C5); this only holds the place where it hangs.
 */
export function Guide({ timezone }: { timezone: string }) {
  const { place } = usePlace();
  const { frame, isLive, dayLabel, look } = useMoment();
  const [open, setOpen] = useState(false);
  useGuide(() => setOpen(true));

  const links = { explore: atlasHref(place), create: createHref(place, isLive ? undefined : frame.time) };
  const city: FilmCity = useMemo(
    () => ({
      name: place.name,
      temp: Math.round(frame.temp),
      lat: place.lat,
      lon: place.lon,
      day: `${dayLabel.relative ?? dayLabel.weekday}, ${dayLabel.date}`,
      time: formatTime(frame.time, timezone),
      sky: [look.palette.sky1, look.palette.sky2, look.palette.sky3],
    }),
    [place, frame, dayLabel, timezone, look],
  );
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-how-it-works
        className="self-start text-caption text-ink-muted underline decoration-white/35 underline-offset-4 transition-colors hover:text-ink hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        Rivedi la guida
      </button>
      <HowItWorks open={open} onClose={() => setOpen(false)} city={city} links={links} />
    </>
  );
}
