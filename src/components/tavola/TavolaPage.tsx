import { TAGLINE } from "@/constants/labels";
import { Wordmark } from "@/components/Wordmark";
import { LocationSearch } from "@/components/location/LocationSearch";
import { PlaceProvider } from "@/components/location/PlaceContext";
import { AutoRefresh } from "@/components/time/AutoRefresh";
import { MomentAddress } from "@/components/time/MomentAddress";
import { MomentFacts } from "@/components/time/MomentFacts";
import { TimeProvider } from "@/components/time/TimeContext";
import { TimeScrubber } from "@/components/time/TimeScrubber";
import { PrecipitationTimeline } from "@/components/weather/PrecipitationTimeline";
import { MapProvider } from "@/components/weather/MapContext";
import { weatherCredit } from "@/lib/credits";
import { SiteFooter } from "@/components/weather/SiteFooter";
import { Chapter } from "@/components/weather/Chapter";
import { DetailsBand } from "@/components/weather/DetailsBand";
import { Guide } from "@/components/explainer/Guide";
import { Territory } from "@/components/weather/CityFacts";
import { WeatherAlerts } from "@/components/weather/WeatherAlert";
import { PromotedDetails } from "@/components/weather/WeatherDetails";
import { WeatherHero } from "@/components/weather/WeatherHero";
import { placeHref } from "@/lib/place";
import type { Section } from "@/lib/sections";
import { readMoment, resolveAddressMoment } from "@/lib/weather/moment-address";
import { momentLabel } from "@/lib/weather/moment-label";
import { loadWeatherPage, type Landing, type SearchParams } from "@/lib/weather-page";
import { detailModules, moonInfo } from "@/lib/weather/details";
import { placeParts } from "@/lib/weather/formatters";
import { buildNarrative } from "@/lib/weather/narrative";
import { precipOutlook } from "@/lib/weather/precipitation";
import { tempRange } from "@/lib/weather/today";
import Link from "next/link";
import { Suspense } from "react";
import { PartsNav } from "./PartsNav";
import { Tavola } from "./Tavola";
import { TerritoryLine } from "./TerritoryLine";

/** The maps are Mapbox's alone: with no token the page has none. */
const MAPBOX = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);

/**
 * The page behind every entry address of the home (ADR-029): `/` and `/crea` render this one tree, and differ only in
 * the section they open on (`initial`) and in where a bare address lands (`landing`: a city drawn at random on `/`, the
 * default place on `/crea`, never a draw for a poster). The weather is loaded once here and handed to the sections by
 * the providers; Meteo is drawn by the server, Crea is a client section in `Tavola` that reads the same providers.
 */
export async function TavolaPage({
  searchParams,
  initial,
  landing,
}: {
  searchParams: SearchParams;
  initial: Section;
  landing: Landing;
}) {
  const { data, timeline, provider, yesterday, scenario, at, landed, renderedAt } = await loadWeatherPage(searchParams, { landing });

  // The moment in the address (`t`, ADR-028): the hour the page opens on, or the word that the forecast does not hold it
  const params = await searchParams;
  const rawT = Array.isArray(params.t) ? params.t[0] : params.t;
  const asked = resolveAddressMoment(
    { timeline, timezone: data.timezone },
    readMoment(rawT === undefined ? "" : new URLSearchParams({ t: rawT })),
  );
  const unavailable =
    asked.status === "unavailable"
      ? {
          asked:
            asked.requested === null
              ? null
              : momentLabel(asked.requested, data.timezone, data.place.name),
        }
      : undefined;

  const range = tempRange(data);
  const precip = precipOutlook(data);
  const precipSection = precip && <PrecipitationTimeline outlook={precip} />;
  const modules = detailModules(data);
  const moon = moonInfo(data);
  const placeKey = `${data.place.lat},${data.place.lon}`;
  // Anything the weather made urgent comes straight after the first screen.
  const urgent =
    data.alerts.some((a) => a.end > data.current.time) ||
    !!precip?.urgent ||
    modules.some((m) => m.promoted);

  return (
    // A new place remounts the time state (back to now) and replays the arrival.
    <TimeProvider
      key={placeKey}
      timeline={timeline}
      moon={{ phase: moon.phase, southern: moon.southern }}
      start={asked.status === "ok" ? asked.start : null}
    >
      <PlaceProvider place={data.place}>
        {/* The maps (the backdrop and the chapter) share Mapbox, the place and its cloud grid */}
        <MapProvider timezone={data.timezone} weatherCredit={weatherCredit(provider)}>
          <AutoRefresh landedAt={landed ? placeHref(data.place) : undefined} />
          <Tavola initial={initial} timezone={data.timezone} mapbox={MAPBOX} unavailable={unavailable}>
            {/* Keeps `t` in the address current with the moment, whichever section is on show */}
            <MomentAddress />
            {/*
            One page that scrolls. Phone: the Testata fills the first screen (place, temperature,
            outlook), Tempo and Territorio follow in one column. Desktop: the Testata stays
            pinned on the left over the sky while the two parts scroll on the right.
          */}
            <div className="mx-auto max-w-[88rem] px-5 sm:px-8 lg:grid lg:grid-cols-12 lg:gap-x-14 lg:px-12">
              {/*
                The search: first thing on a phone; on a computer at the top of
                the right column, so the left one is the place's alone, like a poster.
              */}
              <header className="relative z-30 pt-[max(1rem,env(safe-area-inset-top))] lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:pt-[3.5vh] xl:col-span-6 xl:col-start-7">
                {/* The name, then the search: on one line from a tablet up, the name above on a phone */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                  <div className="flex shrink-0 flex-col gap-1 self-start sm:self-auto">
                    <Link
                      href="/"
                      className="on-sky self-start rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                    >
                      <Wordmark className="text-[1.375rem]" />
                    </Link>
                    {/* The promise (ADR-018), in English over the Italian page */}
                    <p lang="en" className="on-sky text-caption text-ink-muted">
                      {TAGLINE}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <LocationSearch />
                  </div>
                </div>
              </header>

              {/*
              Desktop: pinned at the screen's height (less the bar's room) beside the whole right column, a poster of the
              place: the reading takes the full height and scales to it (see .hero-fit).
            */}
              <div className="relative z-0 before:pointer-events-none before:absolute before:-inset-x-[30vw] before:-inset-y-24 before:-z-1 before:bg-[radial-gradient(ellipse_30rem_22rem_at_50%_55%,color-mix(in_oklab,var(--sky-1)_40%,transparent)_0%,color-mix(in_oklab,var(--sky-1)_20%,transparent)_50%,transparent_100%)] lg:sticky lg:top-0 lg:col-span-5 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:flex xl:col-span-6 lg:h-[calc(100dvh-var(--dock-room))] lg:flex-col lg:gap-[3vh] lg:py-[3.5vh]">
                <div className="flex flex-col gap-7 pb-6 pt-6 lg:min-h-0 lg:flex-1 lg:gap-[3vh] lg:py-0">
                  <div className="hero-fit">
                    <WeatherHero
                      place={data.place}
                      timezone={data.timezone}
                      current={data.current}
                      range={range}
                      // Sample data may simulate another time of day; the clock follows it.
                      renderedAt={
                        provider === "mock" ? data.current.time : renderedAt
                      }
                      outlook={buildNarrative(data)}
                      yesterday={yesterday}
                      unavailable={unavailable}
                      identity={
                        <Suspense fallback={null}>
                          <TerritoryLine lat={data.place.lat} lon={data.place.lon} name={data.place.name} />
                        </Suspense>
                      }
                    />
                  </div>
                </div>
              </div>

              {/* The two parts of Meteo, Tempo and Territorio: a column on the right on a computer, the one column on a phone (over a wash of the sky) */}
              <div className="data-col data-wash relative -mx-5 px-5 pb-[calc(var(--dock-room)+1.5rem)] sm:-mx-8 sm:px-8 lg:col-span-7 lg:col-start-6 lg:row-start-2 lg:mx-0 lg:px-0 lg:pb-[calc(var(--dock-room)+1.5rem)] lg:pt-4 xl:col-span-6 xl:col-start-7">
                {/* The two titles: they lead to the parts and follow the reading; on a computer they stay at the top */}
                <div className="pb-3 pt-2 lg:sticky lg:top-0 lg:z-20 lg:bg-[color-mix(in_oklab,var(--sky-1)_88%,transparent)] lg:pt-3">
                  <PartsNav />
                </div>

                <div id="parte-tempo" className="flex scroll-mt-20 flex-col gap-2.5 pt-3 lg:scroll-mt-16">
                  <h2 className="sr-only">Tempo</h2>
                  {/* The hours ahead as a curve: the one control of the moment (the address' `t` follows it) */}
                  <TimeScrubber />

                  <MomentFacts />

                  {urgent && (
                    <div className="flex flex-col gap-2.5">
                      <WeatherAlerts
                        alerts={data.alerts}
                        now={data.current.time}
                        timezone={data.timezone}
                      />
                      {precip?.urgent && precipSection}
                      <PromotedDetails data={data} modules={modules} />
                    </div>
                  )}

                  {/* The hours themselves live in the timeline above; here only rain on the way */}
                  {precip && !precip.urgent && (
                    <Chapter id="chapter-hours" title="Prossime ore">
                      {precipSection}
                    </Chapter>
                  )}

                  <DetailsBand data={data} modules={modules} maps={MAPBOX} />
                </div>

                {/* The place itself: what it is, its capitals, the towns around, its waters and peaks (streamed; nothing known, no part and no title) */}
                <div id="parte-territorio" className="scroll-mt-20 pt-8 lg:scroll-mt-16 [&:empty]:hidden">
                  <Suspense fallback={<div data-territorio-pending aria-hidden="true" className="skeleton h-40 rounded-lg" />}>
                    <Territory
                      lat={data.place.lat}
                      lon={data.place.lon}
                      name={data.place.name}
                      country={placeParts(data.place).country}
                    />
                  </Suspense>
                </div>

                {/* The foot of the page: where the data comes from, and the guide again (text, not a button of the page) */}
                <div className="flex flex-col gap-5 pt-8">
                  <SiteFooter
                    provider={provider}
                    openWeatherKey={Boolean(process.env.OPENWEATHER_API_KEY)}
                    maps={MAPBOX}
                    updatedAt={data.current.time}
                    timezone={data.timezone}
                    scenario={scenario}
                    at={at}
                  />
                  <Guide timezone={data.timezone} />
                </div>
              </div>

              {/*
              Desktop: a veil of the sky behind the whole right column, over the map and under
              the data, so the numbers read cleanly while the city stays bright beside the name.
              Last in the markup, so it paints above the map (same layer, later in order).
            */}
              <div
                aria-hidden="true"
                className="data-veil pointer-events-none relative -z-1 hidden lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1 lg:block xl:col-span-6 xl:col-start-7"
              />
            </div>
          </Tavola>
        </MapProvider>
      </PlaceProvider>
    </TimeProvider>
  );
}
