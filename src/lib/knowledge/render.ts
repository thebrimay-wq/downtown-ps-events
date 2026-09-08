import type { EventRecord } from "../types";
import { formatLongDate, formatTimeRange, localDateKey } from "../utils";
import { visibleTags } from "../tags";
import type { KnowledgeChunk } from "./types";

// ---------------------------------------------------------------------------
// Turns an event into (a) a markdown section for the knowledge folder and
// (b) a search chunk. Both the build script and the live server use these, so
// an event read from Supabase and an event read from a digest file end up
// identical in the model's eyes.
// ---------------------------------------------------------------------------

export const TRI_VALLEY_CITIES = [
  "Pleasanton",
  "Livermore",
  "Dublin",
  "San Ramon",
  "Danville",
  "Sunol",
] as const;

// Best guess at the city from the address, then the venue, then the tags.
export function cityOf(event: {
  address?: string | null;
  venue?: string | null;
  tags?: string[] | null;
}): string | null {
  const where = `${event.address ?? ""} ${event.venue ?? ""}`.toLowerCase();
  for (const city of TRI_VALLEY_CITIES) {
    if (where.includes(city.toLowerCase())) return city;
  }
  if ((event.tags ?? []).includes("pleasanton")) return "Pleasanton";
  return null;
}

// Whether an event's Pacific-time start falls on a known day.
export function eventDate(event: { start_at: string }): string | null {
  const d = new Date(event.start_at);
  return isNaN(d.getTime()) ? null : localDateKey(d);
}

export function whenLabel(event: {
  start_at: string;
  end_at?: string | null;
  all_day?: boolean;
}): string {
  const day = formatLongDate(event.start_at);
  const time = formatTimeRange(event.start_at, event.end_at, event.all_day);
  return time === "Time not listed" ? `${day} (time not listed)` : `${day}, ${time}`;
}

export function eventLink(event: { slug?: string | null; id: string }): string {
  return `/events/${event.slug ?? event.id}`;
}

// Description text, trimmed to what a search result needs.
export function summary(text: string | null | undefined, max = 400): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 40))}…`;
}

type EventLike = Pick<
  EventRecord,
  | "id"
  | "title"
  | "slug"
  | "description"
  | "start_at"
  | "end_at"
  | "all_day"
  | "venue"
  | "address"
  | "category"
  | "tags"
  | "price"
  | "is_free"
  | "is_family_friendly"
  | "ticket_url"
  | "source_url"
  | "source_name"
>;

// One `## ` section per event. Field lines are `- key: value`; the parser in
// parse.ts reads exactly this shape back, so keep the two in step.
export function eventToMarkdown(event: EventLike): string {
  const field = (key: string, value: unknown) =>
    `- ${key}: ${value === null || value === undefined ? "" : String(value)}`;
  const lines = [
    `## ${event.title.replace(/\s+/g, " ").trim()}`,
    "",
    field("id", event.id),
    field("slug", event.slug),
    field("date", eventDate(event)),
    field("when", whenLabel(event)),
    field("start", event.start_at),
    field("end", event.end_at),
    field("all_day", event.all_day ? "yes" : "no"),
    field("venue", event.venue),
    field("address", event.address),
    field("city", cityOf(event)),
    field("category", event.category),
    field("tags", visibleTags(event.tags).join(", ")),
    field("price", event.price),
    field("free", event.is_free ? "yes" : "no"),
    field("family_friendly", event.is_family_friendly ? "yes" : "no"),
    field("url", event.source_url),
    field("tickets", event.ticket_url),
    field("source", event.source_name),
    "",
    (event.description ?? "").replace(/\r/g, "").trim() || "(no description)",
  ];
  return lines.join("\n");
}

export function eventToChunk(event: EventLike, doc: string): KnowledgeChunk {
  return {
    id: event.id,
    kind: "event",
    doc,
    source: event.source_name ?? "Unknown source",
    url: event.source_url ?? null,
    title: event.title,
    date: eventDate(event),
    end_date: null,
    start_at: event.start_at,
    end_at: event.end_at ?? null,
    all_day: Boolean(event.all_day),
    venue: event.venue ?? null,
    address: event.address ?? null,
    city: cityOf(event),
    category: event.category ?? null,
    price: event.price ?? null,
    is_free: Boolean(event.is_free),
    is_family_friendly: Boolean(event.is_family_friendly),
    link: eventLink(event),
    text: summary(event.description, 600),
  };
}
