import type { EventCategory, EventRecord, Source } from "./types";
import eventsJson from "./events.generated.json";
import sourcesJson from "./sources.generated.json";

// ----------------------------------------------------------------------------
// Bundled dataset. Produced by the Crawl4AI sweep in scripts/crawl4ai — see
// data/CRAWL-REPORT.md for coverage — and used automatically whenever Supabase
// is not configured, so the whole site is browsable with zero setup. Once
// Supabase env vars are set, the data layer reads from the database instead
// and ignores everything here.
//
// Regenerate with:  python3 scripts/crawl4ai/emit.py
// ----------------------------------------------------------------------------

export const BUNDLED_CATEGORIES: EventCategory[] = [
  { id: "c-music", slug: "music", name: "Live Music", icon: "🎵", color: "#d9791f", sort_order: 10 },
  { id: "c-arts", slug: "arts", name: "Arts & Culture", icon: "🎨", color: "#9d4a1a", sort_order: 20 },
  { id: "c-food", slug: "food-drink", name: "Food & Drink", icon: "🍷", color: "#c0611a", sort_order: 30 },
  { id: "c-family", slug: "family", name: "Family & Kids", icon: "🧸", color: "#e3923a", sort_order: 40 },
  { id: "c-market", slug: "market", name: "Markets", icon: "🧺", color: "#7f3c1c", sort_order: 50 },
  { id: "c-community", slug: "community", name: "Community", icon: "🤝", color: "#68331b", sort_order: 60 },
  { id: "c-sports", slug: "sports", name: "Sports & Fitness", icon: "🏃", color: "#d9791f", sort_order: 70 },
  { id: "c-festival", slug: "festival", name: "Festivals", icon: "🎪", color: "#c0611a", sort_order: 80 },
  { id: "c-education", slug: "education", name: "Education", icon: "📚", color: "#9d4a1a", sort_order: 90 },
  { id: "c-nightlife", slug: "nightlife", name: "Nightlife", icon: "🌙", color: "#7f3c1c", sort_order: 100 },
  { id: "c-other", slug: "other", name: "Other", icon: "📌", color: "#8e8e93", sort_order: 999 },
];

export const BUNDLED_SOURCES: Source[] = sourcesJson as Source[];

const SOURCE_ID_BY_NAME = new Map(BUNDLED_SOURCES.map((s) => [s.name, s.id]));

// The generated file holds only the fields that vary per event; status, origin
// and source_id are the same for every row, so they are filled in here rather
// than repeated 1,500 times on disk.
const EVENTS: EventRecord[] = (
  eventsJson as Omit<EventRecord, "status" | "origin">[]
).map((e) => ({
  ...e,
  source_id: SOURCE_ID_BY_NAME.get(e.source_name ?? "") ?? null,
  status: "approved" as const,
  origin: "scraper" as const,
}));

export function getBundledEvents(): EventRecord[] {
  return EVENTS;
}
