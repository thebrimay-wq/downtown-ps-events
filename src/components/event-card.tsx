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
      className="group flex h-full flex-col overflow-hidden rounded-2xl bg-canvas-raised shadow-card ring-1 ring-ink/10 transition duration-300 ease-out hover:-translate-y-0.5 hover:shadow-card-hover"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-canvas-sunken">
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className="grid h-full w-full place-items-center"
            style={{
              background: `linear-gradient(135deg, ${meta.color}26, ${meta.color}0d)`,
              color: meta.color,
            }}
          >
            <CategoryIcon slug={event.category} className="h-10 w-10 opacity-60" />
          </div>
        )}

        {/* Date chip: day in bold, month as a terracotta eyebrow. */}
        <div className="absolute left-3 top-3 min-w-[3rem] rounded-xl bg-canvas-raised px-2.5 py-1.5 text-center shadow-card">
          <span className="tabular block text-lg font-bold leading-none tracking-tight text-ink">
            {formatDayNumber(event.start_at)}
          </span>
          <span className="eyebrow mt-1 block text-[0.625rem] text-brand-600">
            {formatMonthShort(event.start_at)}
          </span>
        </div>

        {event.is_free && (
          <span className="eyebrow absolute right-3 top-3 rounded-full bg-ink px-2.5 py-1.5 text-white">
            Free
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        <div className="eyebrow flex items-center gap-2">
          <span className="tabular text-brand-600">{relativeDayLabel(event.start_at)}</span>
          {!event.all_day && (
            <>
              <span aria-hidden className="text-ink-faint">·</span>
              <span className="tabular font-medium normal-case tracking-normal text-ink-muted">
                {formatTimeRange(event.start_at, event.end_at)}
              </span>
            </>
          )}
        </div>

        <h3 className="text-balance text-[1.0625rem] font-semibold leading-snug tracking-[-0.015em] text-ink transition-colors duration-200 group-hover:text-brand-600">
          {event.title}
        </h3>

        {event.venue && (
          <p className="flex items-center gap-1.5 text-sm text-ink-muted">
            <MapPin aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <span className="truncate">{event.venue}</span>
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          <CategoryBadge slug={event.category} />
          <div className="flex items-center gap-3 text-xs">
            {event.is_family_friendly && (
              <span className="flex items-center gap-1 font-medium text-ink-muted">
                <Baby aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                Kids
              </span>
            )}
            {event.price && !event.is_free && (
              <span className="tabular font-semibold text-ink-soft">{event.price}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
