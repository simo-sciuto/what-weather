/**
 * Whether a development lab is served (WTH-248). The labs are for developing, and on Vercel's preview deployments
 * (where the Mapbox token is set) for looking at them on a phone; a production build never serves them. Read at
 * request time: the pages call `connection()` first, so the build cannot decide it once and for all.
 */
export function labServed(
  env: { NODE_ENV?: string; VERCEL_ENV?: string },
  { previewToo }: { previewToo: boolean },
): boolean {
  if (env.NODE_ENV !== "production") return true;
  return previewToo && env.VERCEL_ENV === "preview";
}

/**
 * Whether a request path may be served (WTH-248): the labs' routes follow `labServed`, everything else is served.
 * The proxy asks this before any page renders, so a production build answers 404 without building a lab page.
 */
export function labRouteServed(pathname: string, env: { NODE_ENV?: string; VERCEL_ENV?: string }): boolean {
  if (pathname === "/lab/atmosfera" || pathname.startsWith("/lab/atmosfera/")) return labServed(env, { previewToo: false });
  if (pathname === "/lab/record" || pathname.startsWith("/lab/record/")) return labServed(env, { previewToo: true });
  return true;
}
