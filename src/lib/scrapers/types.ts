import type { RawScrapedEvent, Source } from "../types";

export interface ScrapeContext {
  source: Source;
  // The fetched HTML for the source URL (pre-fetched by the runner).
  html: string;
  baseUrl: string;
}

// A scraper adapter turns a fetched page into a list of raw event payloads.
// Adapters should be defensive: never throw on malformed markup, just return
// whatever events they can confidently extract.
export interface Scraper {
  key: string;
  // Default category applied when an event's category can't be inferred.
  defaultCategory: string;
  extract: (ctx: ScrapeContext) => RawScrapedEvent[];
}
