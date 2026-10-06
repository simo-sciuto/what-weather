import { Wordmark } from "@/components/Wordmark";
import { LocationSearch } from "@/components/location/LocationSearch";
import { PlaceProvider } from "@/components/location/PlaceContext";
import { SavedPlaces } from "@/components/location/SavedPlaces";
import { AtmosphereMain, TimeProvider } from "@/components/time/TimeContext";
import { Territory } from "@/components/territory/CityFacts";
import { TerritoryMap } from "@/components/territory/TerritoryMap";
import { SiteFooter } from "@/components/weather/SiteFooter";
import { Sky } from "@/components/weather/Sky";
import { parsePlaceRef, placeHref } from "@/lib/place";
import { moonInfo } from "@/lib/weather/details";
import { placeParts, placeSubtitle } from "@/lib/weather/formatters";
import { weatherFor, type SearchParams } from "@/lib/weather-page";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

/** The maps, and so the place's facts, are Mapbox's alone: with no token there is nothing to show here. */
const MAPBOX = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);

const text = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** The place's name from the address alone: the title never waits for a source */
export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const name = parsePlaceRef(await searchParams)?.name;
  return { title: name ? `Territorio di ${name}` : "Territorio" };
}

/**
 * The place's Territorio, a page of its own (WTH-214, docs/APP_AREAS.md): what the place is, the towns around, its
 * waters and peaks, out of the weather page. The same place travels in the address as on the weather page. The
 * default export is synchronous and hands the address to a component under Suspense, so the shell is prerendered.
 */
export default function TerritoryPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<Shell />}>
      <TerritoryView searchParams={searchParams} />
    </Suspense>
  );
}

/** What stands while the place loads: the sky's own colour and a status for screen readers */
function Shell() {
  return (
    <main className="atmosphere min-h-dvh overflow-x-clip" aria-busy="true">
      <p role="status" className="sr-only">
        Caricamento del territorio…
      </p>
    </main>
  );
}

/** The chapter's place while its facts are fetched: rows of the same height, nothing jumps when they come */
function FactsSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4 py-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="skeleton h-5 w-full rounded-lg" />
      ))}
    </div>
  );
}

async function TerritoryView({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const ref = parsePlaceRef(params);
  // There is no random place here: a Territorio is always of a place
  if (!ref) redirect("/");
  const scenario = text(params.mock);
  const at = text(params.at);
  const { data, timeline, provider } = await weatherFor(ref, scenario, at);
  const { place } = data;
  const moon = moonInfo(data);
  const back = placeHref(place);

  return (
    <TimeProvider key={`${place.lat},${place.lon}`} timeline={timeline} moon={{ phase: moon.phase, southern: moon.southern }}>
      <PlaceProvider place={place}>
        <AtmosphereMain className="atmosphere min-h-dvh overflow-x-clip">
          <Sky />
          <div className="mx-auto max-w-[88rem] px-5 sm:px-8 lg:px-12">
            <header className="relative z-30 pt-[max(1rem,env(safe-area-inset-top))] lg:pt-[3.5vh]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                {/* The wordmark goes back to the weather of this place, not to a random city */}
                <Link
                  href={back}
                  className="on-sky shrink-0 self-start rounded-sm sm:self-auto focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                >
                  <Wordmark className="text-[1.375rem]" />
                </Link>
                <div className="min-w-0 flex-1 lg:max-w-xl">
                  <LocationSearch />
                </div>
              </div>
              <div className="mt-3">
                <SavedPlaces />
              </div>
            </header>

            <div className="on-sky flex flex-col gap-6 pb-10 pt-10 lg:pt-16">
              <div className="flex flex-col gap-2">
                <p aria-hidden="true" className="label">
                  Territorio
                </p>
                <h1 className="display-caps text-balance text-[clamp(2.5rem,9vw,6rem)] leading-[0.95]">{place.name}</h1>
                <p className="text-ink-muted">{placeSubtitle(place)}</p>
              </div>

              {/* The land first (the page's first screen), the facts under it: they stream in while it is drawn */}
              {MAPBOX && <TerritoryMap lat={place.lat} lon={place.lon} name={place.name} />}

              {MAPBOX ? (
                <Suspense fallback={<FactsSkeleton />}>
                  <Territory
                    lat={place.lat}
                    lon={place.lon}
                    name={place.name}
                    country={placeParts(place).country}
                    empty={<p className="text-ink-muted">Di questo luogo non abbiamo trovato nulla: né che cos&apos;è, né i dintorni, le acque o le vette.</p>}
                  />
                </Suspense>
              ) : (
                <p className="text-ink-muted">Il territorio si legge sulle mappe: senza il token di Mapbox qui non c&apos;è nulla da mostrare.</p>
              )}

              <Link
                href={back}
                className="label inline-flex min-h-11 items-center self-start rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                ← Il meteo di {place.name}
              </Link>
            </div>

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
        </AtmosphereMain>
      </PlaceProvider>
    </TimeProvider>
  );
}
