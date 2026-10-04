import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AtmosphereLab } from "@/components/lab/AtmosphereLab";

export const metadata: Metadata = {
  title: "Laboratorio atmosfera",
  robots: { index: false, follow: false },
};

/** A calibration tool for the Weather Visual Engine (WTH-046E/K): only while developing. */
export default function AtmosphereLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AtmosphereLab />;
}
