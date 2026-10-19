import { PAGE_LABELS } from "@/constants/labels";
import { Activities } from "@/components/weather/Activities";
import { Almanac } from "@/components/weather/Almanac";
import { Chapter } from "@/components/weather/Chapter";
import { DailyForecast } from "@/components/weather/DailyForecast";
import { DetailsDisclosure } from "@/components/weather/DetailsDisclosure";
import { MapView } from "@/components/weather/MapView";
import { SiteFooter } from "@/components/weather/SiteFooter";
import {
  activityOutlook,
  dailyActivityOutlooks,
} from "@/lib/weather/activities";
import type { WeatherProvider } from "@/lib/api/providers/provider";
import type { DetailModule } from "@/lib/weather/details";
import type { WeatherData } from "@/types/weather";

/**
 * The lower levels of the page (ADR-018): the next 24 hours for outdoor plans and the week stay in view; the rain
 * and cloud map and the almanac of details are the deepest level, closed until asked for (`DetailsDisclosure`); the
 * credits are always there (where the data comes from is never put away). A fragment, so the chapters stay children
 * of the data column's flex container.
 */
export function DetailsBand({
  data,
  modules,
  provider,
  maps,
  scenario,
  at,
}: {
  data: WeatherData;
  modules: DetailModule[];
  provider: WeatherProvider["name"];
  /** The maps are Mapbox's; without a token there is no map chapter */
  maps: boolean;
  scenario: string | undefined;
  at: string | undefined;
}) {
  return (
    <>
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

      <DetailsDisclosure
        title="Dettagli"
        note="Vento, aria, sole e luna"
      >
        {maps && (
          <Chapter
            id="chapter-map"
            title={PAGE_LABELS.map}
            note="Nuvole e pioggia nelle prossime ore"
          >
            <MapView />
          </Chapter>
        )}
        <Almanac data={data} modules={modules} />
      </DetailsDisclosure>

      <SiteFooter
        provider={provider}
        openWeatherKey={Boolean(process.env.OPENWEATHER_API_KEY)}
        maps={maps}
        updatedAt={data.current.time}
        timezone={data.timezone}
        scenario={scenario}
        at={at}
      />
    </>
  );
}
