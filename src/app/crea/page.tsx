import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { Wordmark } from "@/components/Wordmark";
import { PlaceProvider } from "@/components/location/PlaceContext";
import { PhoneNavProvider } from "@/components/layout/PhoneNav";
import { PosterButton } from "@/components/poster/PosterButton";
import { AtmosphereMain, TimeProvider } from "@/components/time/TimeContext";
import { MapProvider } from "@/components/weather/MapContext";
import { Sky } from "@/components/weather/Sky";
import { weatherCredit } from "@/lib/record/credits";
import { createHref, placeHref } from "@/lib/place";
import { formatTime } from "@/lib/weather/formatters";
import { momentFrame } from "@/lib/weather/moment";
import { loadCreatePage, type SearchParams } from "@/lib/weather-page";
import { moonInfo } from "@/lib/weather/details";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

/** The maps are Mapbox's alone: with no token there is no poster. */
const MAPBOX = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  try {
    const { data } = await loadCreatePage(searchParams);
    return { title: `Crea · ${data.place.name}` };
  } catch {
    return {};
  }
}

/**
 * Create (ADR-018): a place and its moment made into a poster, apart from the weather page. For now the same poster
 * maker as the weather page's, on the place in the address; the page's own design follows (WTH-225, step 3).
 */
export default function Create({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // The address is only known at request time: the page's shell is the placeholder, the place streams into it
  return (
    <Suspense fallback={<CreateSkeleton />}>
      <CreateFor searchParams={searchParams} />
    </Suspense>
  );
}

/** A neutral sky and the page's shape while the place arrives (see also app/loading.tsx) */
function CreateSkeleton() {
  return (
    <main
      aria-busy="true"
      className="atmosphere min-h-dvh overflow-x-clip"
    >
      <div className="mx-auto flex min-h-dvh max-w-[88rem] flex-col gap-10 px-5 py-[max(1rem,env(safe-area-inset-top))] sm:px-8 lg:px-12">
        <div className="skeleton mt-4 h-6 w-40 rounded-lg" />
        <div className="flex flex-col gap-5 lg:max-w-[40rem]">
          <div className="skeleton h-4 w-16 rounded-lg" />
          <div className="skeleton h-20 w-full max-w-[28rem] rounded-lg" />
          <div className="skeleton h-4 w-full max-w-[20rem] rounded-lg" />
        </div>
      </div>
    </main>
  );
}

async function CreateFor({ searchParams }: { searchParams: SearchParams }) {
  const { data, timeline, provider, moment } = await loadCreatePage(searchParams);
  const moon = moonInfo(data);
  // The moment on show: now, or a forecast chosen on Explore (WTH-236). Said in words, so it is never taken for now.
  // Without a moment chosen, it is the first frame of the timeline: the current conditions. A moment that is not
  // available is shown as unavailable, never in place of another (WTH-236).
  const frame = !moment.available ? null : moment.start ? momentFrame(timeline, moment.start) : timeline.frames[0];
  const live = !moment.start || moment.start.live;
  const dayLabel = frame ? timeline.dayLabels[frame.dayKey] : null;
  const when = frame && dayLabel
    ? `${dayLabel.weekday} ${dayLabel.date}, ${frame.overview ? "tutto il giorno" : formatTime(frame.time, data.timezone)}`
    : null;

  return (
    <TimeProvider
      key={`${data.place.lat},${data.place.lon}`}
      timeline={timeline}
      moon={{ phase: moon.phase, southern: moon.southern }}
      start={moment.available ? moment.start : null}
    >
      <PlaceProvider place={data.place}>
        <MapProvider
          timezone={data.timezone}
          weatherCredit={weatherCredit(provider)}
        >
          <PhoneNavProvider>
            <TrackOnMount event="create_open" />
            <AtmosphereMain className="atmosphere min-h-dvh overflow-x-clip">
              <Sky />
              <div className="mx-auto flex min-h-dvh max-w-[88rem] flex-col gap-10 px-5 py-[max(1rem,env(safe-area-inset-top))] sm:px-8 lg:px-12">
                <header className="flex items-center justify-between gap-5 pt-4">
                  <Link
                    href="/"
                    className="on-sky rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                  >
                    <Wordmark className="text-[1.375rem]" />
                  </Link>
                  <Link
                    href={placeHref(data.place)}
                    className="on-sky text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                  >
                    Torna al meteo di {data.place.name}
                  </Link>
                </header>
                <section className="flex flex-col gap-5 lg:max-w-[40rem]">
                  <p className="on-sky text-sm uppercase tracking-[0.12em]">
                    Crea
                  </p>
                  <h1 className="on-sky font-display text-[clamp(2.5rem,9vw,5.5rem)] font-semibold leading-[0.95] tracking-[-0.03em]">
                    {data.place.name}
                  </h1>
                  {when && (
                    <p className="on-sky text-sm">
                      {live ? "Adesso" : "Previsione"} · {when}
                    </p>
                  )}
                  <p className="on-sky max-w-[34rem] text-base">
                    {live
                      ? "Il cielo e la mappa di questo luogo, in questo momento, come un poster."
                      : "Il cielo previsto per questo luogo a quel momento, come un poster."}
                  </p>
                  {!moment.available ? (
                    <div className="flex flex-col gap-3">
                      <p role="status" className="on-sky max-w-[34rem] text-sm">
                        Il momento scelto non è più disponibile: il meteo cambia e l’ora può essere passata. Scegline un altro
                        in Explore, oppure crea il poster per il momento attuale.
                      </p>
                      <Link
                        href={createHref(data.place)}
                        className="on-sky text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                      >
                        Crea per il momento attuale
                      </Link>
                    </div>
                  ) : MAPBOX ? (
                    <PosterButton />
                  ) : (
                    <p className="on-sky text-sm">
                      Senza una mappa non si può creare il poster.
                    </p>
                  )}
                </section>
              </div>
            </AtmosphereMain>
          </PhoneNavProvider>
        </MapProvider>
      </PlaceProvider>
    </TimeProvider>
  );
}
