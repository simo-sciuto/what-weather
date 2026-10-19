import { NextResponse, type NextRequest } from "next/server";
import { labRouteServed } from "@/lib/lab-access";

/**
 * The development labs are not served from a production build (WTH-248). The check runs before any page renders, so
 * a production request for a lab gets the not-found page with a 404 status; the labs' own pages keep the same rule.
 */
export function proxy(request: NextRequest) {
  if (labRouteServed(request.nextUrl.pathname, process.env)) return NextResponse.next();
  return NextResponse.rewrite(new URL("/lab-not-found", request.url), { status: 404 });
}

export const config = {
  matcher: "/lab/:path*",
};
