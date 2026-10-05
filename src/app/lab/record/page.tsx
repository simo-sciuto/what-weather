import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RecordLab } from "@/components/lab/RecordLab";

export const metadata: Metadata = {
  title: "Laboratorio record",
  robots: { index: false, follow: false },
};

/**
 * The Visual Record spike (WTH-187): every test record side by side, each exportable. While developing, and on
 * Vercel's preview deployments (where the Mapbox token is set) so it can be seen on a phone; never on the live site.
 */
export default function RecordLabPage() {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") notFound();
  return <RecordLab />;
}
