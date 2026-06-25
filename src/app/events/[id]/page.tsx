import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getEventByIdOrSlug,
  getRelatedEvents,
  usingMockData,
} from "@/lib/data";
import { CategoryBadge } from "@/components/category-badge";
import { AddToCalendar } from "@/components/add-to-calendar";
import { EventCard } from "@/components/event-card";
import { DemoBanner } from "@/components/demo-banner";
import { formatLongDate, formatTimeRange } from "@/lib/utils";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getEventByIdOrSlug(id);
  if (!event) return { title: "Event not found" };
  return {
    title: event.title,
    description: event.description?.slice(0, 160) ?? undefined,
    openGraph: {
      title: event.title,
      images: event.image_url ? [event.image_url] : undefined,
    },
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEventByIdOrSlug(id);
  if (!event) notFound();

  const related = await getRelatedEvents(event);
  const mapsQuery = encodeURIComponent(
    [event.venue, event.address].filter(Boolean).join(", ") || "Pleasanton, CA",
  );

  return (
    <div>
      {usingMockData() && <DemoBanner />}

      {/* Hero image */}
      <div className="relative h-64 w-full overflow-hidden bg-canvas-sunken sm:h-96">
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-6xl">
            🗓️
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      <div className="container-page -mt-16 relative pb-16">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl bg-canvas-raised p-6 shadow-float ring-1 ring-black/[0.04] sm:p-8">
            <Link
              href="/events"
              className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink"
            >
              ← All events
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge slug={event.category} />
              {event.is_free && (
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  Free
                </span>
              )}
              {event.is_family_friendly && (
                <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-800">
                  🧸 Kid-friendly
                </span>
              )}
            </div>

            <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              {event.title}
            </h1>

            {/* Key facts */}
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <Fact icon="calendar" label="Date">
                {formatLongDate(event.start_at)}
              </Fact>
              <Fact icon="clock" label="Time">
                {formatTimeRange(event.start_at, event.end_at)}
              </Fact>
              <Fact icon="pin" label="Location">
                <span className="font-medium text-ink">{event.venue}</span>
                {event.address && (
                  <span className="block text-ink-muted">{event.address}</span>
                )}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  View on map →
                </a>
              </Fact>
              <Fact icon="ticket" label="Price">
                {event.price || (event.is_free ? "Free" : "See details")}
              </Fact>
            </dl>

            {/* Actions */}
            <div className="mt-7 flex flex-wrap gap-3">
              <AddToCalendar event={event} />
              {event.ticket_url && (
                <a
                  href={event.ticket_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-card transition hover:bg-brand-600 active:scale-[0.98]"
                >
                  Get tickets ↗
                </a>
              )}
            </div>

            {/* Description */}
            {event.description && (
              <div className="mt-8 border-t border-black/5 pt-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                  About this event
                </h2>
                <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">
                  {event.description}
                </p>
              </div>
            )}

            {/* Tags */}
            {event.tags && event.tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {event.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-canvas-sunken px-3 py-1 text-xs font-medium text-ink-muted"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Source attribution */}
            {(event.source_name || event.source_url) && (
              <div className="mt-8 border-t border-black/5 pt-5 text-sm text-ink-muted">
                Listed via{" "}
                <span className="font-medium text-ink-soft">
                  {event.source_name ?? "external source"}
                </span>
                {event.source_url && (
                  <>
                    {" · "}
                    <a
                      href={event.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-brand-600 hover:text-brand-700"
                    >
                      View original ↗
                    </a>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Related */}
          {related.length > 0 && (
            <div className="mt-12">
              <h2 className="mb-5 text-xl font-bold tracking-tight text-ink">
                More like this
              </h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: "calendar" | "clock" | "pin" | "ticket";
  label: string;
  children: React.ReactNode;
}) {
  const paths: Record<string, React.ReactNode> = {
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    pin: (
      <>
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
        <circle cx="12" cy="10" r="3" />
      </>
    ),
    ticket: (
      <>
        <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4Z" />
        <path d="M13 5v14" />
      </>
    ),
  };
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-canvas-sunken text-brand-600">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {paths[icon]}
        </svg>
      </span>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          {label}
        </dt>
        <dd className="mt-0.5 text-[15px] text-ink-soft">{children}</dd>
      </div>
    </div>
  );
}
