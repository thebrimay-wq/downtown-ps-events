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

// All approved events (used as the base for all public queries).
async function getApprovedEventsRaw(): Promise<EventRecord[]> {
  const supabase = getServerClient();
  if (!supabase) return getBundledEvents();

  const { data, error } = await supabase
    .from("events")
    .select("*, sources(name)")
    .eq("status", "approved")
    .is("duplicate_of", null)
    .order("start_at", { ascending: true });

  if (error || !data) return [];
  return data.map((row: Record<string, unknown>) => ({
    ...(row as unknown as EventRecord),
    source_name:
      (row.sources as { name?: string } | null)?.name ?? null,
  }));
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
        e.tags?.some((t) => t.toLowerCase().includes(q)),
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
  const { data } = await supabase
    .from("events")
    .select("*, sources(name)")
    .or(`id.eq.${idOrSlug},slug.eq.${idOrSlug}`)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    ...(data as unknown as EventRecord),
    source_name:
      (data.sources as { name?: string } | null)?.name ?? null,
  };
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
  const { data } = await supabase
    .from("events")
    .select("*, sources(name)")
    .eq("status", "pending")
    .order("start_at", { ascending: true });
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...(row as unknown as EventRecord),
    source_name: (row.sources as { name?: string } | null)?.name ?? null,
  }));
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
