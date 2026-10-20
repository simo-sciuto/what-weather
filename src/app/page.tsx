import { TavolaPage } from "@/components/tavola/TavolaPage";
import { placeHref } from "@/lib/place";
import { loadWeatherPage, type SearchParams } from "@/lib/weather-page";
import { conditionLabel, formatTemp } from "@/lib/weather/formatters";
import { buildNarrative } from "@/lib/weather/narrative";
import type { Metadata } from "next";

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

/**
 * The home (ADR-029): Meteo, the weather of a place, on `/`. The same page opens on Crea at `#crea`; a bare address
 * lands on a city drawn at random (ADR-017).
 */
export default function Home({ searchParams }: { searchParams: SearchParams }) {
  return <TavolaPage searchParams={searchParams} initial="meteo" landing="random" />;
}
