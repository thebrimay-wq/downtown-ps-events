import Link from "next/link";
import { Map } from "lucide-react";

// Most arrivals here followed a link to an event that has since ended, so the
// way forward is the calendar, with home as the quieter second choice.
export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="grid h-20 w-20 place-items-center rounded-2xl bg-canvas-sunken text-ink-faint">
        <Map aria-hidden className="h-12 w-12" strokeWidth={1.5} />
      </span>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink">
        Page not found
      </h1>
      <p className="mt-2 max-w-sm text-ink-muted">
        We couldn&apos;t find what you were looking for. It may have ended or
        moved.
      </p>
      <Link
        href="/events"
        className="mt-6 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-card transition hover:bg-brand-700"
      >
        Browse all events
      </Link>
      <Link
        href="/"
        className="mt-4 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
      >
        Back to home
      </Link>
    </div>
  );
}
