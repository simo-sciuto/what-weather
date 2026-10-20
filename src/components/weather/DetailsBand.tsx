import { PAGE_LABELS } from "@/constants/labels";
import { Activities } from "@/components/weather/Activities";
import { Almanac } from "@/components/weather/Almanac";
import { Chapter } from "@/components/weather/Chapter";
import { DailyForecast } from "@/components/weather/DailyForecast";
import { DetailsDisclosure } from "@/components/weather/DetailsDisclosure";
import { MapView } from "@/components/weather/MapView";
import {
  activityOutlook,
  dailyActivityOutlooks,
} from "@/lib/weather/activities";
import type { DetailModule } from "@/lib/weather/details";
import type { WeatherData } from "@/types/weather";

/**
 * The lower levels of the page (ADR-018): the next 24 hours for outdoor plans and the week stay in view; the rain
 * and cloud map and the almanac of details are the deepest level, closed until asked for (`DetailsDisclosure`); the
 * credits are the page's foot, outside the parts (where the data comes from is never put away). A fragment, so the chapters stay children
 * of the data column's flex container.
 */
export function DetailsBand({
  data,
  modules,
  maps,
}: {
  data: WeatherData;
  modules: DetailModule[];
  /** The maps are Mapbox's; without a token there is no map chapter */
  maps: boolean;
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
    </>
  );
}
