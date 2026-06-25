// Shown only when Supabase is not configured, to make clear the data is
// bundled demo content rather than live scraped events.
export function DemoBanner() {
  return (
    <div className="border-b border-brand-200/60 bg-brand-50/80">
      <div className="container-page flex items-center gap-2 py-2 text-xs text-brand-800">
        <span aria-hidden>✨</span>
        <span>
          <strong className="font-semibold">Demo mode.</strong> Showing bundled
          sample events. Configure Supabase &amp; Anthropic (see{" "}
          <code className="rounded bg-brand-100 px-1 py-0.5">.env.example</code>)
          to enable live scraping and persistence.
        </span>
      </div>
    </div>
  );
}
