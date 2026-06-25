import Image from "next/image";
import Link from "next/link";
import type { EventRecord } from "@/lib/types";
import { CategoryBadge } from "./category-badge";
import {
  formatTimeRange,
  relativeDayLabel,
} from "@/lib/utils";

export function EventCard({ event }: { event: EventRecord }) {
  return (
    <Link
      href={`/events/${event.slug ?? event.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl bg-canvas-raised shadow-card ring-1 ring-black/[0.04] transition duration-300 hover:-translate-y-1 hover:shadow-card-hover"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-canvas-sunken">
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-4xl">
            🗓️
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <CategoryBadge slug={event.category} className="shadow-sm" />
          {event.is_free && (
            <span className="rounded-full bg-emerald-500/90 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
              Free
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-600">
          <span>{relativeDayLabel(event.start_at)}</span>
          <span className="text-ink-faint">·</span>
          <span className="text-ink-muted">
            {formatTimeRange(event.start_at, event.end_at)}
          </span>
        </div>

        <h3 className="text-balance text-lg font-semibold leading-snug tracking-tight text-ink">
          {event.title}
        </h3>

        {event.venue && (
          <p className="flex items-center gap-1.5 text-sm text-ink-muted">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="truncate">{event.venue}</span>
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-sm font-medium text-ink-soft">
            {event.price || (event.is_free ? "Free" : "")}
          </span>
          {event.is_family_friendly && (
            <span className="text-xs font-medium text-ink-faint">
              🧸 Kid-friendly
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
