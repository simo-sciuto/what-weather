import { Suspense } from "react";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The query as it is in the address, for the content of the route to say (and for the tests to see change) */
async function RouteQuery({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) for (const one of [value ?? []].flat()) query.append(key, one);
  const text = query.toString();
  return <p data-atlas-route-query={text}>{text ? `Indirizzo: ${text}` : "Nessun punto nell'indirizzo."}</p>;
}

/**
 * What the route itself holds, for now: its name, for a screen reader (the map is drawn by the shell in the layout).
 * No weather, no place: the movements of the map ask for nothing (M3).
 */
export default function AtlasPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <h1>Atlante del meteo</h1>
      <Suspense fallback={null}>
        <RouteQuery searchParams={searchParams} />
      </Suspense>
    </>
  );
}
