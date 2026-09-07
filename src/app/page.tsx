import Link from "next/link";
import { ArrowRight, CalendarDays, Inbox, MapPin, Moon, PartyPopper, Search, Sparkles, Sun, type LucideIcon } from "lucide-react";
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

export const revalidate = 300;

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

      {/* Hero. The search field is the primary action; the sunset mesh is the
          one atmospheric effect on the site and stays inside this section. */}
      <section className="relative overflow-hidden">
        <div className="hero-mesh animate-warm-in absolute inset-0" aria-hidden />
        <div className="container-page relative pb-14 pt-14 sm:pb-20 sm:pt-24">
          <div className="max-w-3xl">
            <p
              className="animate-fade-up inline-flex items-center gap-2 rounded-full bg-canvas-raised px-3.5 py-1.5 text-sm font-medium text-brand-600 shadow-card ring-1 ring-ink/10"
              style={{ animationDelay: "0ms" }}
            >
              <MapPin aria-hidden className="h-4 w-4" strokeWidth={2} />
              Pleasanton, California
            </p>

            <h1
              className="display animate-fade-up mt-6 text-balance text-[2.75rem] text-ink sm:text-[4rem] lg:text-[4.75rem]"
              style={{ animationDelay: "80ms" }}
            >
              What&apos;s happening in{" "}
              <span className="text-brand-600">Pleasanton</span>
            </h1>

            <p
              className="animate-fade-up mt-5 max-w-xl text-lg leading-relaxed text-ink-soft"
              style={{ animationDelay: "160ms" }}
            >
              Every concert, market, festival and family outing across the
              Tri-Valley, gathered into one calendar.
            </p>

            <form
              action="/events"
              className="animate-fade-up mt-8 flex max-w-xl items-center gap-2 rounded-2xl bg-canvas-raised p-2 shadow-card ring-1 ring-ink/10 transition focus-within:ring-2 focus-within:ring-brand-500"
              style={{ animationDelay: "240ms" }}
            >
              <Search aria-hidden className="ml-3 h-5 w-5 shrink-0 text-ink-muted" strokeWidth={2} />
              <input
                name="search"
                placeholder="Search events, artists, venues…"
                aria-label="Search events"
                className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-base text-ink placeholder:text-ink-muted focus:outline-none"
              />
              <button
                type="submit"
                className="min-h-11 shrink-0 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-brand-700 active:scale-[0.98]"
              >
                Search
              </button>
            </form>

            <p
              className="animate-fade-up mt-4 text-sm text-ink-muted"
              style={{ animationDelay: "280ms" }}
            >
              Or just ask:{" "}
              <Link
                href="/ask?q=What%27s+happening+this+weekend%3F"
                className="group inline-flex items-center gap-1 font-semibold text-brand-600 transition-colors hover:text-brand-700"
              >
                <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
                &ldquo;What&apos;s happening this weekend?&rdquo;
                <ArrowRight aria-hidden className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </p>

            <dl
              className="animate-fade-up mt-7 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm text-ink-muted"
              style={{ animationDelay: "320ms" }}
            >
              <Stat value={meta.events.toLocaleString("en-US")} label="events" />
              <Stat value={String(meta.sources)} label="local sources" />
              <Stat value="12" label="months ahead" />
            </dl>

            <div
              className="animate-fade-up mt-8 flex flex-wrap gap-2"
              style={{ animationDelay: "400ms" }}
            >
              {Object.entries(CATEGORY_META)
                .filter(([slug]) => slug !== "other")
                .slice(0, 8)
                .map(([slug, category]) => (
                  <Link
                    key={slug}
                    href={`/events?category=${slug}`}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-canvas-raised px-3.5 text-sm font-semibold text-ink-soft ring-1 ring-ink/10 transition duration-200 hover:-translate-y-0.5 hover:text-ink hover:shadow-card"
                  >
                    <CategoryIcon slug={slug} className="h-4 w-4" />
                    {category.label}
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </section>

      <Section title="Today in Pleasanton" eyebrow="Happening now" eyebrowIcon={Sun} href="/events?date=today" linkLabel="See all today">
        {today.length > 0 ? (
          <CardGrid events={today} />
        ) : (
          <EmptyState icon={Moon} title="A quiet day in town" description="Nothing listed for today in Pleasanton. The weekend is close." />
        )}
      </Section>

      <Section title="This weekend in Pleasanton" eyebrow="Make plans" eyebrowIcon={PartyPopper} href="/events?date=weekend" linkLabel="See the weekend">
        {weekend.length > 0 ? (
          <CardGrid events={weekend.slice(0, 6)} />
        ) : (
          <EmptyState icon={Inbox} title="No weekend events yet" description="New events arrive as our sources publish them." />
        )}
      </Section>

      <Section title="Coming up" eyebrow="On the horizon" eyebrowIcon={CalendarDays} href="/events" linkLabel="Browse the whole Tri-Valley">
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
      <span aria-hidden>{label}</span>
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
          <p className="eyebrow flex items-center gap-1.5 text-brand-600">
            <EyebrowIcon aria-hidden className="h-4 w-4" strokeWidth={2.25} />
            {eyebrow}
          </p>
          <h2 className="display mt-2 text-[1.875rem] text-ink sm:text-[2.25rem]">{title}</h2>
        </div>
        <Link
          href={href}
          className="group inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
        >
          {linkLabel}
          <ArrowRight aria-hidden className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>
      {children}
    </section>
  );
}

function CardGrid({ events }: { events: Awaited<ReturnType<typeof getEvents>> }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event, i) => (
        <div key={event.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 5) * 50}ms` }}>
          <EventCard event={event} />
        </div>
      ))}
    </div>
  );
}
