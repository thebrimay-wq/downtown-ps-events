import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Inbox,
  MapPin,
  Moon,
  PartyPopper,
  Search,
  Sun,
  type LucideIcon,
} from "lucide-react";
import {
  getTodayEvents,
  getWeekendEvents,
  getEvents,
  inPleasanton,
  usingBundledData,
} from "@/lib/data";
import { EventCard } from "@/components/event-card";
import { EmptyState } from "@/components/empty-state";
import { CategoryIcon } from "@/components/category-icon";
import { BundledDataBanner } from "@/components/bundled-data-banner";
import { CATEGORY_META } from "@/lib/categories";
import meta from "@/lib/dataset-meta.generated.json";

export const revalidate = 300; // refresh homepage data every 5 minutes

export default async function HomePage() {
  const [allToday, allWeekend, allUpcoming] = await Promise.all([
    getTodayEvents(),
    getWeekendEvents(),
    getEvents(),
  ]);

  // The homepage headings say Pleasanton, so the rails show Pleasanton.
  const today = allToday.filter(inPleasanton);
  const weekend = allWeekend.filter(inPleasanton);
  const upcoming = allUpcoming.filter(inPleasanton);

  return (
    <div>
      {usingBundledData() && <BundledDataBanner />}

      {/* Hero — the search field is the primary call to action. */}
      <section className="relative overflow-hidden">
        <div className="container-page pb-12 pt-14 sm:pb-16 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center animate-fade-up">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-canvas-raised px-4 py-1.5 text-sm font-medium text-brand-700 shadow-sm ring-1 ring-black/[0.04]">
              <MapPin aria-hidden className="h-4 w-4 text-accent-600" />
              Pleasanton, California
            </p>

            <h1 className="display text-balance text-[2.75rem] leading-[1.05] text-ink sm:text-6xl lg:text-7xl">
              What&apos;s happening in{" "}
              <span className="text-brand-700">Pleasanton?</span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-balance text-lg leading-relaxed text-ink-muted">
              Every local concert, market, festival, and family outing —
              gathered from across the community into one calendar.
            </p>

            <form
              action="/events"
              className="mx-auto mt-9 flex max-w-xl items-center gap-2 rounded-2xl bg-canvas-raised p-2 shadow-card ring-1 ring-black/[0.05] transition focus-within:ring-2 focus-within:ring-brand-400"
            >
              <Search
                aria-hidden
                className="ml-3 h-5 w-5 shrink-0 text-ink-faint"
              />
              <input
                name="search"
                placeholder="Search events, artists, venues…"
                aria-label="Search events"
                className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-base text-ink placeholder:text-ink-muted focus:outline-none"
              />
              <button
                type="submit"
                className="shrink-0 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-brand-700 active:scale-[0.98]"
              >
                Search
              </button>
            </form>

            {/* Proof that the calendar is actually populated. */}
            <dl className="mx-auto mt-7 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-sm text-ink-muted">
              <Stat value={meta.events.toLocaleString("en-US")} label="events" />
              <Stat value={String(meta.sources)} label="local sources" />
              <Stat value="12" label="months ahead" />
            </dl>

            <div className="mx-auto mt-9 flex max-w-2xl flex-wrap justify-center gap-2">
              {Object.entries(CATEGORY_META)
                .filter(([slug]) => slug !== "other")
                .slice(0, 8)
                .map(([slug, category]) => (
                  <Link
                    key={slug}
                    href={`/events?category=${slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-canvas-raised px-3.5 py-2 text-sm font-medium text-ink-soft shadow-sm ring-1 ring-black/[0.05] transition duration-200 hover:-translate-y-0.5 hover:text-ink hover:shadow-card"
                  >
                    <CategoryIcon
                      slug={slug}
                      className="h-4 w-4"
                    />
                    {category.label}
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </section>

      <Section
        title="Today in Pleasanton"
        eyebrow="Happening now"
        eyebrowIcon={Sun}
        href="/events?date=today"
        linkLabel="See all today"
      >
        {today.length > 0 ? (
          <CardGrid events={today} />
        ) : (
          <EmptyState
            icon={Moon}
            title="Nothing scheduled for today"
            description="Check out what's coming up this weekend instead."
          />
        )}
      </Section>

      <Section
        title="This weekend in Pleasanton"
        eyebrow="Make plans"
        eyebrowIcon={PartyPopper}
        href="/events?date=weekend"
        linkLabel="See the weekend"
      >
        {weekend.length > 0 ? (
          <CardGrid events={weekend.slice(0, 6)} />
        ) : (
          <EmptyState
            icon={Inbox}
            title="No weekend events yet"
            description="New events are added as our sources publish them."
          />
        )}
      </Section>

      <Section
        title="Coming up"
        eyebrow="On the horizon"
        eyebrowIcon={CalendarDays}
        href="/events"
        linkLabel="Browse the whole Tri-Valley"
      >
        {upcoming.length > 0 ? (
          <CardGrid events={upcoming.slice(0, 6)} />
        ) : (
          <EmptyState title="No upcoming events" />
        )}
      </Section>

      <div className="h-8" />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="sr-only">{label}</dt>
      <dd className="tabular text-base font-bold text-ink">{value}</dd>
      <span aria-hidden className="text-ink-muted">
        {label}
      </span>
    </div>
  );
}

function Section({
  title,
  eyebrow,
  eyebrowIcon: EyebrowIcon,
  href,
  linkLabel,
  children,
}: {
  title: string;
  eyebrow: string;
  eyebrowIcon: LucideIcon;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="container-page py-10 sm:py-14">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-[0.1em] text-brand-700">
            <EyebrowIcon aria-hidden className="h-4 w-4" strokeWidth={2.25} />
            {eyebrow}
          </p>
          <h2 className="display mt-2 text-3xl text-ink sm:text-4xl">{title}</h2>
        </div>
        <Link
          href={href}
          className="group inline-flex shrink-0 items-center gap-1 rounded-full text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
        >
          {linkLabel}
          <ArrowRight
            aria-hidden
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
          />
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
