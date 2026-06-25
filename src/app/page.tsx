import Link from "next/link";
import { getTodayEvents, getWeekendEvents, getEvents, usingMockData } from "@/lib/data";
import { EventCard } from "@/components/event-card";
import { EmptyState } from "@/components/empty-state";
import { DemoBanner } from "@/components/demo-banner";
import { CATEGORY_META } from "@/lib/categories";

export const revalidate = 300; // refresh homepage data every 5 minutes

export default async function HomePage() {
  const [today, weekend, upcoming] = await Promise.all([
    getTodayEvents(),
    getWeekendEvents(),
    getEvents(),
  ]);

  return (
    <div>
      {usingMockData() && <DemoBanner />}

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container-page pb-10 pt-16 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center animate-fade-up">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-canvas-raised px-4 py-1.5 text-sm font-medium text-brand-700 shadow-sm ring-1 ring-black/[0.04]">
              <span aria-hidden>📍</span> Pleasanton, California
            </p>
            <h1 className="text-balance text-4xl font-bold tracking-tight text-ink sm:text-6xl">
              What&apos;s happening in{" "}
              <span className="text-brand-600">Pleasanton?</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-balance text-lg text-ink-muted">
              Every local concert, market, festival, and family outing —
              gathered from across the community into one beautiful calendar.
            </p>

            {/* Search */}
            <form
              action="/events"
              className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-2xl bg-canvas-raised p-2 shadow-card ring-1 ring-black/[0.05] focus-within:ring-2 focus-within:ring-brand-400"
            >
              <span className="pl-3 text-ink-faint" aria-hidden>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </span>
              <input
                name="search"
                placeholder="Search events, artists, venues…"
                aria-label="Search events"
                className="flex-1 bg-transparent px-1 py-2 text-base text-ink placeholder:text-ink-faint focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 active:scale-[0.98]"
              >
                Search
              </button>
            </form>

            {/* Category quick links */}
            <div className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
              {Object.entries(CATEGORY_META)
                .filter(([slug]) => slug !== "other")
                .slice(0, 8)
                .map(([slug, meta]) => (
                  <Link
                    key={slug}
                    href={`/events?category=${slug}`}
                    className="rounded-full bg-canvas-raised px-3.5 py-1.5 text-sm font-medium text-ink-soft shadow-sm ring-1 ring-black/[0.05] transition hover:bg-black/[0.03] hover:text-ink"
                  >
                    <span aria-hidden>{meta.icon}</span> {meta.label}
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </section>

      {/* Today */}
      <Section
        title="Today in Pleasanton"
        eyebrow="🌤️ Happening now"
        href="/events?date=today"
        linkLabel="See all today"
      >
        {today.length > 0 ? (
          <CardGrid events={today} />
        ) : (
          <EmptyState
            icon="🌙"
            title="Nothing scheduled for today"
            description="Check out what's coming up this weekend instead."
          />
        )}
      </Section>

      {/* This weekend */}
      <Section
        title="This weekend"
        eyebrow="🎉 Make plans"
        href="/events?date=weekend"
        linkLabel="See the weekend"
      >
        {weekend.length > 0 ? (
          <CardGrid events={weekend.slice(0, 6)} />
        ) : (
          <EmptyState
            icon="📭"
            title="No weekend events yet"
            description="New events are added as our sources publish them."
          />
        )}
      </Section>

      {/* Upcoming */}
      <Section
        title="Coming up"
        eyebrow="🗓️ On the horizon"
        href="/events"
        linkLabel="Browse all events"
      >
        {upcoming.length > 0 ? (
          <CardGrid events={upcoming.slice(0, 6)} />
        ) : (
          <EmptyState title="No upcoming events" />
        )}
      </Section>

      <div className="h-10" />
    </div>
  );
}

function Section({
  title,
  eyebrow,
  href,
  linkLabel,
  children,
}: {
  title: string;
  eyebrow: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="container-page py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {title}
          </h2>
        </div>
        <Link
          href={href}
          className="shrink-0 text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          {linkLabel} →
        </Link>
      </div>
      {children}
    </section>
  );
}

function CardGrid({ events }: { events: Awaited<ReturnType<typeof getEvents>> }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}
