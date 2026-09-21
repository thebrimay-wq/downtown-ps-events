import type { Metadata } from "next";
import Link from "next/link";
import { fromZonedTime } from "date-fns-tz";
import { getEvents, usingBundledData } from "@/lib/data";
import type { EventFilters as Filters, EventRecord } from "@/lib/types";
import { EventCard } from "@/components/event-card";
import { EventFilters } from "@/components/event-filters";
import { ViewToggle } from "@/components/view-toggle";
import { CalendarView } from "@/components/calendar-view";
import { EmptyState } from "@/components/empty-state";
import { ShowMore } from "@/components/show-more";
import {
  FilterCount,
  FilterResults,
  FilterTransitionProvider,
} from "@/components/filter-transition";
import { BundledDataBanner } from "@/components/bundled-data-banner";
import { TZ, isThisWeekend, isToday, localDateKey } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Browse Events",
  description:
    "Browse and filter upcoming events in Pleasanton and across the Tri-Valley.",
};

export const revalidate = 300;

// How many cards a page carries before "Show more". The full list is over a
// thousand cards and 11 MB of HTML; on a phone it was half a million pixels
// tall.
const PAGE_SIZE = 60;

type SearchParams = Record<string, string | string[] | undefined>;

function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// A calendar day link asks for date=YYYY-MM-DD; the presets are words.
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

// The instants that bound one Pleasanton calendar day.
function dayBounds(key: string): Pick<Filters, "from" | "to"> {
  return {
    from: fromZonedTime(`${key}T00:00:00`, TZ).toISOString(),
    to: fromZonedTime(`${key}T23:59:59.999`, TZ).toISOString(),
  };
}

function applyDatePreset(events: EventRecord[], preset?: string): EventRecord[] {
  if (!preset) return events;
  if (preset === "today") return events.filter((e) => isToday(e.start_at));
  if (preset === "weekend")
    return events.filter((e) => isThisWeekend(e.start_at));
  if (preset === "week") {
    const cutoff = Date.now() + 7 * 24 * 60 * 60 * 1000;
    return events.filter((e) => new Date(e.start_at).getTime() <= cutoff);
  }
  return events;
}

type DayGroup = { key: string; total: number; events: EventRecord[] };

// Group events by their local date key for the list view, keeping only the
// first `limit` cards. A group cut short still knows its full size, so the
// day heading stays honest and the next page picks the same day up again.
function groupByDay(events: EventRecord[], limit: number): DayGroup[] {
  const groups: DayGroup[] = [];
  let shown = 0;
  for (const e of events) {
    const key = localDateKey(new Date(e.start_at));
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = { key, total: 0, events: [] };
      groups.push(group);
    }
    group.total += 1;
    if (shown < limit) {
      group.events.push(e);
      shown += 1;
    }
  }
  return groups.filter((g) => g.events.length > 0);
}

const dayHeadingFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: TZ,
});

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const datePreset = str(sp.date);
  const filters: Filters = {
    category: str(sp.category),
    search: str(sp.search),
    location: str(sp.location),
    free: str(sp.free) === "1",
    familyFriendly: str(sp.family) === "1",
    ...(datePreset && DAY_KEY.test(datePreset) ? dayBounds(datePreset) : {}),
  };
  const view = str(sp.view) === "calendar" ? "calendar" : "list";
  const month = str(sp.month);
  const limit = Math.max(1, parseInt(str(sp.limit) ?? "", 10) || PAGE_SIZE);
  const hasFilters = ["category", "search", "location", "free", "family", "date"]
    .some((key) => str(sp[key]));

  let events = await getEvents(filters);
  events = applyDatePreset(events, datePreset);

  // The header count is the whole result; only the cards are cut.
  const grouped = groupByDay(events, limit);
  const shown = Math.min(limit, events.length);
  const remaining = events.length - shown;
  const moreHref = (() => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      const v = str(value);
      if (v !== undefined && key !== "limit") next.set(key, v);
    }
    next.set("limit", String(Math.min(limit + PAGE_SIZE, events.length)));
    return `/events?${next.toString()}`;
  })();

  return (
    <FilterTransitionProvider>
      {usingBundledData() && <BundledDataBanner />}

      {/* Page header */}
      <div className="container-page pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="display text-[2rem] text-ink sm:text-[2.75rem]">
              Events in Pleasanton &amp; the Tri-Valley
            </h1>
            <p className="mt-2 text-ink-muted">
              <FilterCount total={events.length} />
            </p>
          </div>
          <ViewToggle />
        </div>
      </div>

      {/* Sticky filters */}
      <div className="sticky top-16 z-40 mt-6 border-y border-ink/10 glass">
        <div className="container-page py-4">
          <EventFilters />
        </div>
      </div>

      {/* Results */}
      <FilterResults>
        <div className="container-page py-8">
          {events.length === 0 ? (
            <EmptyState
              title="No events match your filters"
              description="Try clearing a filter or widening your date range."
              action={
                hasFilters && (
                  <Link
                    href="/events"
                    className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white shadow-card transition hover:bg-ink-soft"
                  >
                    Clear all filters
                  </Link>
                )
              }
            />
          ) : view === "calendar" ? (
            <CalendarView events={events} month={month} params={sp} />
          ) : (
            <div className="space-y-12">
              {grouped.map((day) => (
                <section key={day.key}>
                  <h2 className="eyebrow mb-5 flex items-center gap-3 text-ink-muted">
                    <span className="text-ink">
                      {dayHeadingFmt.format(new Date(`${day.key}T12:00:00`))}
                    </span>
                    <span className="h-px flex-1 bg-ink/10" />
                    <span className="tabular">
                      {day.total} event{day.total === 1 ? "" : "s"}
                    </span>
                  </h2>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {day.events.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                </section>
              ))}
              {remaining > 0 && (
                <ShowMore
                  href={moreHref}
                  step={Math.min(PAGE_SIZE, remaining)}
                  shown={shown}
                  total={events.length}
                />
              )}
            </div>
          )}
        </div>
      </FilterResults>
    </FilterTransitionProvider>
  );
}
