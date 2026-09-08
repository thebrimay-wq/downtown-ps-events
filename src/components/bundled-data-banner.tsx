import { Database } from "lucide-react";
import meta from "@/lib/dataset-meta.generated.json";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Formatted here rather than with toLocaleDateString so server and client
// always agree on the string.
function formatDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`;
}

// Shown only when Supabase is not configured, to make clear the events come
// from the bundled crawl rather than a live database.
export function BundledDataBanner() {
  return (
    <div className="border-b border-accent-200/70 bg-accent-100/70">
      <div className="container-page flex items-start gap-2 py-2 text-xs leading-relaxed text-ink-soft">
        <Database aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        <span>
          <strong className="font-semibold">No database connected.</strong>{" "}
          <span className="tabular">
            {meta.events.toLocaleString("en-US")}
          </span>{" "}
          events from {meta.sources} local sources, crawled{" "}
          {formatDay(meta.generated_at)}.{" "}
          <span className="hidden sm:inline">
            Connect Supabase (see{" "}
            <code className="rounded bg-accent-200/60 px-1 py-0.5">
              .env.example
            </code>
            ) for live scraping and submissions.
          </span>
        </span>
      </div>
    </div>
  );
}
