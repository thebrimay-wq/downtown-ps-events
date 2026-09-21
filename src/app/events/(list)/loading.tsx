// Shown while /events renders for the first time on a cold navigation. Six
// placeholders at the real card size, so the page settles into place rather
// than jumping when the list arrives.
export default function EventsLoading() {
  return (
    <div className="container-page py-10" aria-busy="true">
      <span className="sr-only">Loading events…</span>
      <div className="h-9 w-72 max-w-full animate-pulse rounded-lg bg-canvas-sunken sm:h-12 sm:w-[28rem]" />
      <div className="mt-3 h-5 w-40 animate-pulse rounded bg-canvas-sunken" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl bg-canvas-raised shadow-card ring-1 ring-ink/10"
          >
            <div className="aspect-[16/10] animate-pulse bg-canvas-sunken" />
            <div className="space-y-3 p-4 sm:p-5">
              <div className="h-3 w-1/3 animate-pulse rounded bg-canvas-sunken" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-canvas-sunken" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-canvas-sunken" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
