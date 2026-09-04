import "server-only";
import { getServerClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/env";
import {
  BUNDLED_CATEGORIES,
  BUNDLED_SOURCES,
  getBundledEvents,
} from "./bundled-data";
import type {
  EventCategory,
  EventFilters,
  EventRecord,
  ScrapedEventLog,
  Source,
  SubmittedEvent,
} from "./types";
import { isThisWeekend, isToday, isUpcoming } from "./utils";
import { hasAllDayTag, visibleTags } from "./tags";

// ---------------------------------------------------------------------------
// Read layer. Reads from Supabase when configured; otherwise returns the
// bundled crawl results so the UI is fully functional with no setup.
// ---------------------------------------------------------------------------

// True when no database is configured and the site is serving the bundled
// crawl results instead of live Supabase rows.
export function usingBundledData(): boolean {
  return !isSupabaseConfigured;
}

export async function getCategories(): Promise<EventCategory[]> {
  const supabase = getServerClient();
  if (!supabase) return BUNDLED_CATEGORIES;
  const { data, error } = await supabase
    .from("event_categories")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error || !data?.length) return BUNDLED_CATEGORIES;
  return data as EventCategory[];
}

export async function getSources(): Promise<Source[]> {
  const supabase = getServerClient();
  if (!supabase) return BUNDLED_SOURCES;
  const { data, error } = await supabase
    .from("sources")
    .select("*")
    .order("name", { ascending: true });
  if (error || !data?.length) return BUNDLED_SOURCES;
  return data as Source[];
}

// PostgREST caps a single response at 1,000 rows and gives no error when it
// truncates, so an unpaginated select silently loses everything past the
// thousandth event. Page until a short response says we have them all.
const PAGE_SIZE = 1000;

type Row = Record<string, unknown>;

// Typed by what pagination actually needs, rather than by supabase-js's
// generics, which are awkward to name at a call boundary like this.
type RangeableQuery = PromiseLike<{ data: Row[] | null; error: unknown }> & {
  range: (from: number, to: number) => PromiseLike<{
    data: Row[] | null;
    error: unknown;
  }>;
};

async function fetchAllRows(build: () => RangeableQuery): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
    if (error) break;
    if (!data?.length) break;
    rows.push(...(data as Row[]));
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

function toEventRecord(row: Row): EventRecord {
  const event = row as unknown as EventRecord;
  return {
    ...event,
    // Reconstructed from tags, which is where it is persisted.
    all_day: hasAllDayTag(event.tags),
    source_name: (row.sources as { name?: string } | null)?.name ?? null,
  };
}

// All approved events (used as the base for all public queries).
async function getApprovedEventsRaw(): Promise<EventRecord[]> {
  const supabase = getServerClient();
  if (!supabase) return getBundledEvents();

  const rows = await fetchAllRows(() =>
    supabase
      .from("events")
      .select("*, sources(name)")
      .eq("status", "approved")
      .is("duplicate_of", null)
      .order("start_at", { ascending: true }),
  );
  return rows.map(toEventRecord);
}

function applyFilters(
  events: EventRecord[],
  filters: EventFilters = {},
): EventRecord[] {
  let out = events;

  if (filters.category) {
    out = out.filter((e) => e.category === filters.category);
  }
  if (filters.free) {
    out = out.filter((e) => e.is_free);
  }
  if (filters.familyFriendly) {
    out = out.filter((e) => e.is_family_friendly);
  }
  if (filters.location) {
    const loc = filters.location.toLowerCase();
    out = out.filter(
      (e) =>
        e.venue?.toLowerCase().includes(loc) ||
        e.address?.toLowerCase().includes(loc),
    );
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    out = out.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.venue?.toLowerCase().includes(q) ||
        visibleTags(e.tags).some((t) => t.toLowerCase().includes(q)),
    );
  }
  if (filters.from) {
    const from = new Date(filters.from).getTime();
    out = out.filter((e) => new Date(e.start_at).getTime() >= from);
  }
  if (filters.to) {
    const to = new Date(filters.to).getTime();
    out = out.filter((e) => new Date(e.start_at).getTime() <= to);
  }
  return out;
}

export async function getEvents(
  filters: EventFilters = {},
  opts: { upcomingOnly?: boolean } = { upcomingOnly: true },
): Promise<EventRecord[]> {
  let events = await getApprovedEventsRaw();
  if (opts.upcomingOnly) events = events.filter((e) => isUpcoming(e.start_at));
  return applyFilters(events, filters).sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  );
}

export async function getTodayEvents(): Promise<EventRecord[]> {
  const events = await getApprovedEventsRaw();
  return events
    .filter((e) => isToday(e.start_at))
    .sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    );
}

export async function getWeekendEvents(): Promise<EventRecord[]> {
  const events = await getApprovedEventsRaw();
  return events
    .filter((e) => isThisWeekend(e.start_at) && isUpcoming(e.start_at))
    .sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    );
}

export async function getEventByIdOrSlug(
  idOrSlug: string,
): Promise<EventRecord | null> {
  const supabase = getServerClient();
  if (!supabase) {
    const events = getBundledEvents();
    return (
      events.find((e) => e.id === idOrSlug || e.slug === idOrSlug) ?? null
    );
  }
  // `id` is a uuid column: asking Postgres to compare it to a slug fails the
  // whole query, which turned every slug-based event link into a 404 once the
  // database was connected. Decide which column to match before asking.
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrSlug,
    );
  const { data } = await supabase
    .from("events")
    .select("*, sources(name)")
    .eq(isUuid ? "id" : "slug", idOrSlug)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return toEventRecord(data as Row);
}

export async function getRelatedEvents(
  event: EventRecord,
  limit = 3,
): Promise<EventRecord[]> {
  const events = await getEvents({ category: event.category ?? undefined });
  return events.filter((e) => e.id !== event.id).slice(0, limit);
}

// --- Admin reads (return empty in mock mode; there is nothing pending) -------

export async function getPendingEvents(): Promise<EventRecord[]> {
  const supabase = getServerClient();
  if (!supabase) return [];
  const rows = await fetchAllRows(() =>
    supabase
      .from("events")
      .select("*, sources(name)")
      .eq("status", "pending")
      .order("start_at", { ascending: true }),
  );
  return rows.map(toEventRecord);
}

export async function getSubmittedEvents(): Promise<SubmittedEvent[]> {
  const supabase = getServerClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("submitted_events")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as SubmittedEvent[];
}

export async function getScrapeLogs(limit = 20): Promise<ScrapedEventLog[]> {
  const supabase = getServerClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("scraped_event_logs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ScrapedEventLog[];
}

// The bundled dataset (and, once configured, the scrapers) reach across the
// wider Tri-Valley. This narrows a list to Pleasanton proper, which is what the
// homepage rails promise; /events exposes the full regional set.
export function inPleasanton(event: EventRecord): boolean {
  const where = `${event.venue ?? ""} ${event.address ?? ""}`.toLowerCase();
  return where.includes("pleasanton");
}

export function categoryBySlug(
  categories: EventCategory[],
  slug?: string | null,
): EventCategory | undefined {
  if (!slug) return undefined;
  return categories.find((c) => c.slug === slug);
}
