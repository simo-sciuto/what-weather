import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AtmosphereLab } from "@/components/lab/AtmosphereLab";
import { labServed } from "@/lib/lab-access";

export const metadata: Metadata = {
  title: "Laboratorio atmosfera",
  robots: { index: false, follow: false },
};

/**
 * A calibration tool for the Weather Visual Engine (WTH-046E/K): only while developing. `connection()` makes the page
 * render per request, so the guard runs at request time; a prerendered page would keep the lab in the build (WTH-248).
 */
export default async function AtmosphereLabPage() {
  await connection();
  if (!labServed(process.env, { previewToo: false })) notFound();
  return <AtmosphereLab />;
}
