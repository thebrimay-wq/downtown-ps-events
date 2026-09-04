import Image from "next/image";
import Link from "next/link";
import { Baby, MapPin } from "lucide-react";
import type { EventRecord } from "@/lib/types";
import { CategoryBadge } from "./category-badge";
import { CategoryIcon } from "./category-icon";
import { categoryMeta } from "@/lib/categories";
import {
  formatDayNumber,
  formatMonthShort,
  formatTimeRange,
  relativeDayLabel,
} from "@/lib/utils";

export function EventCard({ event }: { event: EventRecord }) {
  const meta = categoryMeta(event.category);

  return (
    <Link
      href={`/events/${event.slug ?? event.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl bg-canvas-raised shadow-card ring-1 ring-black/[0.07] transition duration-300 ease-out hover:-translate-y-1 hover:shadow-card-hover"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-canvas-sunken">
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          // Most scraped listings ship no artwork, so the category stands in
          // for one rather than leaving every card the same grey rectangle.
          <div
            className="grid h-full w-full place-items-center"
            style={{
              background: `linear-gradient(135deg, ${meta.color}26, ${meta.color}0d)`,
              color: meta.color,
            }}
          >
            <CategoryIcon
              slug={event.category}
              className="h-10 w-10 opacity-60 transition-transform duration-500 ease-out group-hover:scale-110"
            />
          </div>
        )}

        {/* Ticket-stub date, so the day is readable before the title is. */}
        <div className="absolute left-3 top-3 flex w-12 flex-col items-center overflow-hidden rounded-xl bg-canvas-raised/95 py-1.5 shadow-card backdrop-blur">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-700">
            {formatMonthShort(event.start_at)}
          </span>
          <span className="tabular text-lg font-bold leading-none text-ink">
            {formatDayNumber(event.start_at)}
          </span>
        </div>

        {event.is_free && (
          <span className="absolute right-3 top-3 rounded-full bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
            Free
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em]">
          <span className="tabular text-brand-700">
            {relativeDayLabel(event.start_at)}
          </span>
          {!event.all_day && (
            <>
              <span aria-hidden className="text-ink-faint">
                ·
              </span>
              <span className="tabular font-medium normal-case tracking-normal text-ink-muted">
                {formatTimeRange(event.start_at, event.end_at)}
              </span>
            </>
          )}
        </div>

        <h3 className="text-balance text-lg font-semibold leading-snug tracking-[-0.01em] text-ink transition-colors duration-200 group-hover:text-brand-800">
          {event.title}
        </h3>

        {event.venue && (
          <p className="flex items-center gap-1.5 text-sm text-ink-muted">
            <MapPin
              aria-hidden
              className="h-4 w-4 shrink-0 text-accent-600"
              strokeWidth={2}
            />
            <span className="truncate">{event.venue}</span>
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <CategoryBadge slug={event.category} />
          <div className="flex items-center gap-2.5 text-xs">
            {event.is_family_friendly && (
              <span className="flex items-center gap-1 font-medium text-ink-muted">
                <Baby aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                Kids
              </span>
            )}
            {event.price && !event.is_free && (
              <span className="tabular font-semibold text-ink-soft">
                {event.price}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
