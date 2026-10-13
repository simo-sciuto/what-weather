import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { RecordLab } from "@/components/lab/RecordLab";
import { labServed } from "@/lib/lab-access";

export const metadata: Metadata = {
  title: "Laboratorio record",
  robots: { index: false, follow: false },
};

/**
 * The Visual Record spike (WTH-187): every test record side by side, each exportable. While developing, and on
 * Vercel's preview deployments (where the Mapbox token is set) so it can be seen on a phone; never on the live site.
 */
export default async function RecordLabPage() {
  // Read per request: a prerendered page would keep the lab in the build (WTH-248)
  await connection();
  if (!labServed(process.env, { previewToo: true })) notFound();
  return <RecordLab />;
}
