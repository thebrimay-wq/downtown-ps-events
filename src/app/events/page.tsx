import type { Metadata } from "next";
import { getEvents, usingBundledData } from "@/lib/data";
import type { EventFilters as Filters, EventRecord } from "@/lib/types";
import { EventCard } from "@/components/event-card";
import { EventFilters } from "@/components/event-filters";
import { ViewToggle } from "@/components/view-toggle";
import { CalendarView } from "@/components/calendar-view";
import { EmptyState } from "@/components/empty-state";
import { BundledDataBanner } from "@/components/bundled-data-banner";
import { isThisWeekend, isToday, localDateKey } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Browse Events",
  description:
    "Browse and filter upcoming events in Pleasanton and across the Tri-Valley.",
};

export const revalidate = 300;

type SearchParams = Record<string, string | string[] | undefined>;

function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
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

// Group a list of events by their local date key for the list view.
function groupByDay(events: EventRecord[]): [string, EventRecord[]][] {
  const map = new Map<string, EventRecord[]>();
  for (const e of events) {
    const key = localDateKey(new Date(e.start_at));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return [...map.entries()];
}

const dayHeadingFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "America/Los_Angeles",
});

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters: Filters = {
    category: str(sp.category),
    search: str(sp.search),
    location: str(sp.location),
    free: str(sp.free) === "1",
    familyFriendly: str(sp.family) === "1",
  };
  const datePreset = str(sp.date);
  const view = str(sp.view) === "calendar" ? "calendar" : "list";

  let events = await getEvents(filters);
  events = applyDatePreset(events, datePreset);

  const grouped = groupByDay(events);

  return (
    <div>
      {usingBundledData() && <BundledDataBanner />}

      {/* Page header */}
      <div className="container-page pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="display text-[2rem] leading-tight text-ink sm:text-[2.75rem]">
              Events in Pleasanton &amp; the Tri-Valley
            </h1>
            <p className="mt-1.5 text-ink-muted">
              <span className="tabular font-semibold text-ink-soft">
                {events.length.toLocaleString("en-US")}
              </span>{" "}
              upcoming event{events.length === 1 ? "" : "s"}
            </p>
          </div>
          <ViewToggle />
        </div>
      </div>

      {/* Sticky filters */}
      <div className="sticky top-16 z-40 mt-6 border-y border-black/5 glass">
        <div className="container-page py-4">
          <EventFilters />
        </div>
      </div>

      {/* Results */}
      <div className="container-page py-8">
        {events.length === 0 ? (
          <EmptyState
            title="No events match your filters"
            description="Try clearing a filter or widening your date range."
          />
        ) : view === "calendar" ? (
          <CalendarView events={events} />
        ) : (
          <div className="space-y-10">
            {grouped.map(([dayKey, dayEvents]) => (
              <section key={dayKey}>
                <h2 className="mb-4 flex items-center gap-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
                  <span>
                    {dayHeadingFmt.format(new Date(`${dayKey}T12:00:00`))}
                  </span>
                  <span className="h-px flex-1 bg-black/[0.06]" />
                  <span className="text-ink-muted">
                    {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
                  </span>
                </h2>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {dayEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
