import { TavolaPage } from "@/components/tavola/TavolaPage";
import { loadWeatherPage, type SearchParams } from "@/lib/weather-page";
import type { Metadata } from "next";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  try {
    const { data } = await loadWeatherPage(searchParams, { landing: "default" });
    return {
      title: `Crea · ${data.place.name}`,
      // An entry address, not a page of its own (ADR-029): the canonical page is `/`, which holds Crea at `#crea`
      robots: { index: false, follow: true },
      alternates: { canonical: "/" },
    };
  } catch {
    return {};
  }
}

/**
 * `/crea` (ADR-018, ADR-029): the entry address that opens the home on Crea. It renders the same tree as `/` (the
 * weather, the sections), on the place in the address or else on the default place, never on a city drawn at random:
 * a poster is made of a place somebody chose.
 */
export default function Create({ searchParams }: { searchParams: SearchParams }) {
  return <TavolaPage searchParams={searchParams} initial="crea" landing="default" />;
}
