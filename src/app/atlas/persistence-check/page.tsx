import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ATLAS_TEST_MAP } from "@/components/atlas/atlas-test";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * A second page inside the Atlas layout, for the tests only: the map must survive a change of page, not only of the
 * address's parameters, and a page of its own is what shows it. In any build that is not made for the tests it is a 404.
 */
export default function PersistenceCheck() {
  if (!ATLAS_TEST_MAP) notFound();
  return <p data-atlas-persistence-check>Un’altra pagina dentro la stessa shell.</p>;
}
