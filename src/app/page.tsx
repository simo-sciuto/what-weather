import { Wordmark } from "@/components/Wordmark";
import { LocationSearch } from "@/components/location/LocationSearch";
import { PlaceProvider } from "@/components/location/PlaceContext";
import { SavedPlaces } from "@/components/location/SavedPlaces";
import { AutoRefresh } from "@/components/time/AutoRefresh";
import { PhoneNavProvider, Sheet } from "@/components/layout/PhoneNav";
import { PhoneBar } from "@/components/time/HeroMeta";
import { MomentFacts } from "@/components/time/MomentFacts";
import { AtmosphereMain, TimeProvider } from "@/components/time/TimeContext";
import { TimeScrubber } from "@/components/time/TimeScrubber";
import { Activities } from "@/components/weather/Activities";
import { Almanac } from "@/components/weather/Almanac";
import { Chapter } from "@/components/weather/Chapter";
import { DailyForecast } from "@/components/weather/DailyForecast";
import { PrecipitationTimeline } from "@/components/weather/PrecipitationTimeline";
import { MapBackdropGL } from "@/components/weather/MapBackdropGL";
import { MapProvider } from "@/components/weather/MapContext";
import { MapView } from "@/components/weather/MapView";
import { MapSheet } from "@/components/weather/MapControls";
import { MapGestures } from "@/components/weather/MapGestures";
import { Territory } from "@/components/weather/CityFacts";
import { SiteFooter } from "@/components/weather/SiteFooter";
import { Sky } from "@/components/weather/Sky";
import { WeatherAlerts } from "@/components/weather/WeatherAlert";
import { PromotedDetails } from "@/components/weather/WeatherDetails";
import { WeatherHero } from "@/components/weather/WeatherHero";
import { placeHref } from "@/lib/place";
import { loadWeatherPage, type SearchParams } from "@/lib/weather-page";
import {
  activityOutlook,
  dailyActivityOutlooks,
} from "@/lib/weather/activities";
import { detailModules, moonInfo } from "@/lib/weather/details";
import { conditionLabel, formatTemp } from "@/lib/weather/formatters";
import { buildNarrative } from "@/lib/weather/narrative";
import { precipOutlook } from "@/lib/weather/precipitation";
import { tempRange } from "@/lib/weather/today";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

/** The maps are Mapbox's alone: with no token the page has none. */
const MAPBOX = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  try {
    const { data } = await loadWeatherPage(searchParams);
    const title = `${data.place.name} ${formatTemp(data.current.temp)} · ${conditionLabel(data.current)}`;
    const description = buildNarrative(data);
    // A shared link shows the place's sky and reading (see /api/og).
    const image = {
      url: `/api/og${placeHref(data.place).slice(1)}`,
      width: 1200,
      height: 630,
      alt: `${title}. ${description}`,
    };
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: [image],
        type: "website",
        locale: "it_IT",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [image],
      },
    };
  } catch {
    return {};
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const {
    data,
    timeline,
    provider,
    yesterday,
    scenario,
    at,
    landed,
    renderedAt,
  } = await loadWeatherPage(searchParams);

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
    >
      <PlaceProvider place={data.place}>
        {/* The maps (the backdrop and the chapter) share Mapbox, the place and its cloud grid */}
        <MapProvider timezone={data.timezone}>
          <PhoneNavProvider>
            <AutoRefresh
              landedAt={landed ? placeHref(data.place) : undefined}
            />
            <AtmosphereMain className="atmosphere min-h-dvh overflow-x-clip">
              <Sky />
              {/*
              The city's map, fixed behind the whole screen like the sky: it
              stays put while the page scrolls over it, with the city pinned
              between the place's name and the clock, strongest there and held
              back under the reading. Only the city's coloured lines are drawn; the sky shows
              between them. Early in the markup, so the data's veils (.data-col, .data-veil)
              paint over it.
            */}
              <MapBackdropGL className="backdrop-fade pointer-events-none fixed inset-0 -z-1" />
              {/* On a phone the page stays still and the finger moves the map */}
              {MAPBOX && <MapGestures />}
              {/* On a phone a bar at the foot of the screen: the weather data, the poster, the map */}
              <PhoneBar />
              <MapSheet />
              {/*
            Phone: the first screen is the sky and one reading (place, temperature,
            outlook, the timeline); chapters follow. Desktop: the reading stays
            pinned on the left over the sky while the chapters scroll on the right.
          */}
              <div className="mx-auto max-w-[88rem] px-5 sm:px-8 lg:grid lg:grid-cols-12 lg:gap-x-14 lg:px-12">
                {/*
                The search and the saved places: first thing on a phone; on a computer at the top of
                the right column, so the left one is the place's alone, like a poster.
              */}
                <header className="relative z-30 pt-[max(1rem,env(safe-area-inset-top))] lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:pt-[3.5vh] xl:col-span-6 xl:col-start-7">
                  {/* The name, then the search: on one line from a tablet up, the name above on a phone */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                    <Link
                      href="/"
                      className="on-sky shrink-0 self-start rounded-sm sm:self-auto focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                    >
                      <Wordmark className="text-[1.375rem]" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <LocationSearch />
                    </div>
                  </div>
                  {/* Saved places, one tap away: small pills under the search */}
                  <div className="mt-3">
                    <SavedPlaces />
                  </div>
                </header>

                {/*
              Desktop: pinned at the screen's height beside the whole right column, a poster of the
              place: the reading takes the full height and scales to it (see .hero-fit).
            */}
                <div className="relative z-0 before:pointer-events-none before:absolute before:-inset-x-[30vw] before:-inset-y-24 before:-z-1 before:bg-[radial-gradient(ellipse_30rem_22rem_at_50%_55%,color-mix(in_oklab,var(--sky-1)_40%,transparent)_0%,color-mix(in_oklab,var(--sky-1)_20%,transparent)_50%,transparent_100%)] lg:sticky lg:top-0 lg:col-span-5 lg:col-start-1 lg:row-span-3 lg:row-start-1 lg:flex xl:col-span-6 lg:h-dvh lg:flex-col lg:gap-[3vh] lg:py-[3.5vh]">
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
                      />
                    </div>
                  </div>
                </div>

                {/* On a phone the weather data are a sheet that rises over the map; on a computer the right column */}
                <Sheet name="data" title="Meteo" desktop="contents">
                  {/* The hours ahead: under the reading on a phone, at the top of the right column on a computer */}
                  <div className="data-col data-col-first relative pb-8 pt-2 lg:col-span-7 lg:col-start-6 lg:row-start-2 lg:pb-0 lg:pt-8 xl:col-span-6 xl:col-start-7">
                    <TimeScrubber />
                  </div>

                  <div className="data-col relative flex flex-col gap-14 pb-6 lg:col-span-7 lg:col-start-6 lg:row-start-3 lg:pb-10 lg:pt-8 xl:col-span-6 xl:col-start-7">
                    {/* The moment's quick facts lead the data: this column on a computer, the sheet on a phone */}
                    <MomentFacts />

                    {urgent && (
                      <div className="flex flex-col gap-8">
                        <WeatherAlerts
                          alerts={data.alerts}
                          now={data.current.time}
                          timezone={data.timezone}
                        />
                        {precip?.urgent && precipSection}
                        <PromotedDetails data={data} modules={modules} />
                      </div>
                    )}

                    {/* The hours themselves live in the timeline beside the reading; here only rain on the way */}
                    {precip && !precip.urgent && (
                      <Chapter id="chapter-hours" title="Prossime ore">
                        {precipSection}
                      </Chapter>
                    )}

                    {/* The next 24 hours, or the day picked in the week below */}
                    <Activities
                      next={activityOutlook(data)}
                      days={dailyActivityOutlooks(data)}
                    />

                    <Chapter
                      id="chapter-week"
                      title="Settimana"
                      note="Scegli un giorno per esplorarlo"
                    >
                      <DailyForecast data={data} />
                    </Chapter>

                    {/* The maps are Mapbox's; without a token there is no map chapter */}
                    {MAPBOX && (
                      <Chapter
                        id="chapter-map"
                        title="Mappa"
                        note="Nuvole e pioggia nelle prossime ore"
                      >
                        <MapView />
                      </Chapter>
                    )}

                    <Chapter id="chapter-almanac" title="Dettagli">
                      <Almanac data={data} modules={modules} />
                    </Chapter>

                    {/* The place itself, after its weather: what it is, the towns around, its waters and peaks (streamed; nothing known, no chapter) */}
                    <Suspense fallback={null}>
                      <Territory
                        lat={data.place.lat}
                        lon={data.place.lon}
                        name={data.place.name}
                      />
                    </Suspense>

                    <SiteFooter
                      provider={provider}
                      openWeatherKey={Boolean(process.env.OPENWEATHER_API_KEY)}
                      maps={MAPBOX}
                      updatedAt={data.current.time}
                      timezone={data.timezone}
                      scenario={scenario}
                      at={at}
                    />
                  </div>
                </Sheet>

                {/*
                Desktop: a veil of the sky behind the whole right column, over the map and under
                the data, so the numbers read cleanly while the city stays bright beside the name.
                Last in the markup, so it paints above the map (same layer, later in order).
              */}
                <div
                  aria-hidden="true"
                  className="data-veil pointer-events-none relative -z-1 hidden lg:col-span-7 lg:col-start-6 lg:row-span-3 lg:row-start-1 lg:block xl:col-span-6 xl:col-start-7"
                />
              </div>
            </AtmosphereMain>
          </PhoneNavProvider>
        </MapProvider>
      </PlaceProvider>
    </TimeProvider>
  );
}
