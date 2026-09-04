import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-black/5 bg-canvas-raised/50">
      <div className="container-page flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-md">
          <p className="text-sm font-semibold text-ink">Pleasanton Events Hub</p>
          <p className="mt-1 text-sm text-ink-muted">
            A community-run calendar gathering local events from across
            Pleasanton, California. Not affiliated with the City of Pleasanton.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
          <Link href="/events" className="hover:text-ink">
            Browse events
          </Link>
          <Link href="/submit" className="hover:text-ink">
            Submit an event
          </Link>
          <Link href="/admin" className="hover:text-ink">
            Admin
          </Link>
        </nav>
      </div>
      <div className="container-page pb-8 text-xs text-ink-muted">
        © {new Date().getFullYear()} Pleasanton Events Hub · Made with care for
        the Tri-Valley community.
      </div>
    </footer>
  );
}
