"use client";

import { LAST_PLACE_COOKIE } from "@/lib/place";
import { useRouter } from "next/navigation";

/**
 * Upstream failures never show raw errors. Offer a retry, and a way out when
 * the problem is the place itself (the last place is remembered in a cookie,
 * so a plain reload would land on it again).
 */
export default function WeatherError({ retry }: { retry: () => void }) {
  const router = useRouter();

  function startOver() {
    document.cookie = `${LAST_PLACE_COOKIE}=; path=/; max-age=0`;
    router.replace("/");
  }

  return (
    <main className="atmosphere grid min-h-dvh place-items-center px-5">
      <div role="alert" className="max-w-sm text-center">
        <p className="label">Meteo</p>
        <p className="mt-4 font-display text-4xl leading-tight">Impossibile caricare il meteo.</p>
        <p className="mt-3 text-sm text-ink-muted">Il servizio delle previsioni non ha risposto. Di solito dura poco.</p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-full border border-ink/30 px-6 py-3 text-sm font-medium transition-colors hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Riprova
          </button>
          <button
            type="button"
            onClick={startOver}
            className="rounded-full px-4 py-2 text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Ricomincia dalla località predefinita
          </button>
        </div>
      </div>
    </main>
  );
}
