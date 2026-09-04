import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-ink/10 bg-canvas-raised/60">
      <div className="container-page flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-md">
          <p className="text-sm font-bold tracking-tight text-ink">Pleasanton Events Hub</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            A community-run calendar gathering local events from across
            Pleasanton and the Tri-Valley. Not affiliated with the City of Pleasanton.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink-muted">
          <Link href="/events" className="transition-colors hover:text-brand-600">Browse events</Link>
          <Link href="/submit" className="transition-colors hover:text-brand-600">Submit an event</Link>
          <Link href="/admin" className="transition-colors hover:text-brand-600">Admin</Link>
        </nav>
      </div>
      <div className="container-page flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 py-5 text-xs text-ink-muted">
        <span>© {new Date().getFullYear()} Pleasanton Events Hub</span>
        <span>Tri-Valley, California</span>
      </div>
    </footer>
  );
}
