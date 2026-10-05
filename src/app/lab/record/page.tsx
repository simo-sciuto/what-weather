import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RecordLab } from "@/components/lab/RecordLab";

export const metadata: Metadata = {
  title: "Laboratorio record",
  robots: { index: false, follow: false },
};

/** The Visual Record spike (WTH-187): every test record side by side, each exportable. Only while developing. */
export default function RecordLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <RecordLab />;
}
