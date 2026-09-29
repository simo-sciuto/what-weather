/**
 * Skeleton in the page's own layout, on a neutral night sky: search field,
 * place and time, the temperature, the outlook, the facts, the timeline and
 * the week. A band of light sweeps across all of it (see .skeleton). With
 * Cache Components this is the prerendered shell, served at once while the
 * weather streams in; data fills in, nothing jumps.
 */

function Bar({ className }: { className: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

/** Rows straight on the sky, like the week and the details. */
function CardSkeleton({ className = "", rows = 4 }: { className?: string; rows?: number }) {
  return (
    <div className={`flex flex-col gap-4 py-2 ${className}`}>
      <div className="flex justify-between">
        <Bar className="h-3 w-16" />
        <Bar className="h-3 w-20" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <Bar key={i} className="h-5 w-full" />
      ))}
    </div>
  );
}

export default function Loading() {
  return (
    <main className="atmosphere min-h-dvh overflow-x-clip" aria-busy="true">
      <p role="status" className="sr-only">
        Caricamento del meteo…
      </p>
      <div aria-hidden="true" className="mx-auto max-w-[88rem] px-5 sm:px-8 lg:grid lg:grid-cols-12 lg:gap-x-14 lg:px-12">
        <div className="lg:col-span-5 lg:flex xl:col-span-6 lg:h-dvh lg:flex-col lg:gap-[3.5vh] lg:py-[4vh]">
          <div className="shrink-0">
            <div className="skeleton glass h-12 rounded-full" />
            {/* Saved-place pills */}
            <div className="mt-3 flex gap-2">
              {[5, 6, 4.5].map((w) => (
                <div key={w} className="skeleton h-9 rounded-full" style={{ width: `${w}rem` }} />
              ))}
            </div>
          </div>
          <div className="flex flex-col pb-10 pt-7 lg:py-0">
            {/* Place, day, temperature beside its sky, outlook, facts, timeline */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <Bar className="h-8 w-36 lg:h-10 lg:w-52" />
                <Bar className="h-4 w-28" />
              </div>
              <Bar className="h-5 w-12" />
            </div>
            <Bar className="mt-7 h-4 w-52" />
            <div className="mt-4 flex items-center gap-5">
              <Bar className="h-32 w-40 lg:h-40 lg:w-52" />
              <div className="flex flex-col gap-2">
                <div className="skeleton size-10 rounded-full" />
                <Bar className="h-6 w-28" />
                <Bar className="h-4 w-24" />
              </div>
            </div>
            <Bar className="mt-6 h-6 w-full max-w-sm" />
            <Bar className="mt-2 h-6 w-2/3 max-w-xs" />
            <div className="mt-6 grid grid-cols-3 gap-4 border-y border-rule py-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Bar className="h-2.5 w-12" />
                  <Bar className="h-5 w-10" />
                </div>
              ))}
            </div>
            {/* The timeline: title, the curve's band, the icons under it */}
            <div className="sheet mt-7 flex flex-col gap-4">
              <div className="flex justify-between">
                <Bar className="h-3 w-24" />
                <Bar className="h-3 w-28" />
              </div>
              <Bar className="h-24 w-full rounded-xl" />
              <div className="flex justify-between">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="skeleton size-5 rounded-full" />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-10 pb-10 lg:col-span-7 lg:pt-8 xl:col-span-6">
          {[5, 7].map((rows, i) => (
            <div key={i} className="flex flex-col gap-4">
              <Bar className="h-5 w-28" />
              <CardSkeleton rows={rows} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
