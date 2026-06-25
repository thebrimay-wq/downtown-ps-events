import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedEvent, Source } from "../types";
import type { Scraper } from "./types";
import { fetchHtml } from "./fetch";
import { normalizeEvents, aiEnabled } from "../ai/normalize";
import { compareEvents, dedupeHash } from "../dedupe";
import { slugify } from "../utils";

import { pleasantonDowntown } from "./sources/pleasanton-downtown";
import { farmersMarket } from "./sources/farmers-market";
import { cityOfPleasanton } from "./sources/city-of-pleasanton";
import { hacienda } from "./sources/hacienda";
import { eventbrite } from "./sources/eventbrite";
import { bandsintown } from "./sources/bandsintown";
import { pleasantonWeekly } from "./sources/pleasanton-weekly";

// Registry: source.scraper_key -> adapter.
export const SCRAPERS: Record<string, Scraper> = {
  "pleasanton-downtown": pleasantonDowntown,
  "farmers-market": farmersMarket,
  "city-of-pleasanton": cityOfPleasanton,
  hacienda,
  eventbrite,
  bandsintown,
  "pleasanton-weekly": pleasantonWeekly,
};

export interface ScrapeRunSummary {
  sources: number;
  found: number;
  created: number;
  updated: number;
  duplicates: number;
  errors: string[];
  aiNormalization: boolean;
}

interface ExistingEvent {
  id: string;
  title: string;
  start_at: string;
  venue: string | null;
  dedupe_hash: string | null;
}

// Runs all enabled scrapers and persists results as pending events.
export async function runScrapers(
  admin: SupabaseClient,
  sources: Source[],
): Promise<ScrapeRunSummary> {
  const referenceDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
  }).format(new Date());

  const summary: ScrapeRunSummary = {
    sources: 0,
    found: 0,
    created: 0,
    updated: 0,
    duplicates: 0,
    errors: [],
    aiNormalization: aiEnabled(),
  };

  // Load existing future events once for in-memory dedupe.
  const { data: existingRows } = await admin
    .from("events")
    .select("id, title, start_at, venue, dedupe_hash")
    .gte("start_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  const existing: ExistingEvent[] = (existingRows ?? []) as ExistingEvent[];
  const existingHashes = new Set(
    existing.map((e) => e.dedupe_hash).filter(Boolean) as string[],
  );

  for (const source of sources) {
    if (!source.enabled) continue;
    const scraper = SCRAPERS[source.scraper_key];
    if (!scraper) {
      summary.errors.push(`No scraper registered for "${source.scraper_key}"`);
      continue;
    }
    summary.sources++;

    const logStart = new Date().toISOString();
    let status: "ok" | "error" | "partial" = "ok";
    let found = 0;
    let created = 0;
    let duplicates = 0;
    let errorMessage: string | null = null;
    let rawSample: unknown = null;

    try {
      const html = await fetchHtml(source.url);
      const raw = scraper.extract({ source, html, baseUrl: source.url });
      found = raw.length;
      rawSample = raw.slice(0, 3);

      const normalized = await normalizeEvents(raw, referenceDate);

      for (const event of normalized) {
        const hash = dedupeHash(event);

        // Exact duplicate already in DB → skip.
        if (existingHashes.has(hash)) {
          duplicates++;
          continue;
        }

        // Fuzzy duplicate detection against existing events.
        const match = existing.find(
          (e) => compareEvents(event, e).isDuplicate,
        );

        const row = buildEventRow(event, source, hash, match?.id ?? null);
        const { data: inserted, error } = await admin
          .from("events")
          .insert(row)
          .select("id, title, start_at, venue, dedupe_hash")
          .single();

        if (error) {
          // Unique slug/hash collisions are treated as duplicates.
          duplicates++;
          continue;
        }

        created++;
        if (match) duplicates++;

        // Track newly inserted events so later events in the same run dedupe too.
        existingHashes.add(hash);
        existing.push(inserted as ExistingEvent);
      }
    } catch (err) {
      status = "error";
      errorMessage = err instanceof Error ? err.message : String(err);
      summary.errors.push(`${source.slug}: ${errorMessage}`);
    }

    summary.found += found;
    summary.created += created;
    summary.duplicates += duplicates;

    // Write the run log + update source status (best-effort).
    await admin.from("scraped_event_logs").insert({
      source_id: source.id,
      source_slug: source.slug,
      started_at: logStart,
      finished_at: new Date().toISOString(),
      status,
      items_found: found,
      items_created: created,
      items_duplicate: duplicates,
      error_message: errorMessage,
      raw_sample: rawSample,
    });
    await admin
      .from("sources")
      .update({ last_run_at: new Date().toISOString(), last_status: status })
      .eq("id", source.id);
  }

  return summary;
}

function buildEventRow(
  event: NormalizedEvent,
  source: Source,
  hash: string,
  duplicateOf: string | null,
) {
  return {
    title: event.title,
    slug: `${slugify(event.title)}-${hash.slice(0, 6)}`,
    description: event.description,
    start_at: event.start_at,
    end_at: event.end_at,
    venue: event.venue,
    address: event.address,
    category: event.category,
    tags: event.tags,
    price: event.price,
    is_free: event.is_free,
    is_family_friendly: event.is_family_friendly,
    image_url: event.image_url,
    ticket_url: event.ticket_url,
    source_id: source.id,
    source_url: event.source_url ?? source.url,
    status: "pending",
    origin: "scraper",
    duplicate_of: duplicateOf,
    dedupe_hash: hash,
  };
}
