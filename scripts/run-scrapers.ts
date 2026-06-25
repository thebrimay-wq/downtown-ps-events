/**
 * CLI entry point for the scraping pipeline.
 *
 *   npm run scrape
 *
 * Reads enabled sources from Supabase, runs every registered scraper, normalizes
 * results (AI when ANTHROPIC_API_KEY is set, heuristic otherwise), dedupes, and
 * inserts new events as `pending` for admin review. Used by the GitHub Actions
 * cron and runnable locally.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (+ NEXT_PUBLIC_SUPABASE_URL).
 */
import { createClient } from "@supabase/supabase-js";
import { runScrapers } from "../src/lib/scrapers";
import type { Source } from "../src/lib/types";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "Set them in the environment before running the scraper.",
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: sources, error } = await admin
    .from("sources")
    .select("*")
    .eq("enabled", true);

  if (error) {
    console.error("Failed to load sources:", error.message);
    process.exit(1);
  }
  if (!sources || sources.length === 0) {
    console.warn("No enabled sources found. Did you run supabase/seed.sql?");
    process.exit(0);
  }

  console.log(`Scraping ${sources.length} source(s)…`);
  const summary = await runScrapers(admin, sources as Source[]);

  console.log("\n=== Scrape summary ===");
  console.log(`AI normalization: ${summary.aiNormalization ? "on" : "off (heuristic)"}`);
  console.log(`Sources scraped:  ${summary.sources}`);
  console.log(`Events found:     ${summary.found}`);
  console.log(`New (pending):    ${summary.created}`);
  console.log(`Duplicates:       ${summary.duplicates}`);
  if (summary.errors.length) {
    console.log(`\nErrors (${summary.errors.length}):`);
    for (const e of summary.errors) console.log(`  - ${e}`);
  }
}

main().catch((err) => {
  console.error("Scrape run crashed:", err);
  process.exit(1);
});
