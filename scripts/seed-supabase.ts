/**
 * Loads the bundled crawl results into Supabase.
 *
 *   npm run seed
 *
 * Upserts categories, sources and events in batches through supabase-js, which
 * is far more reliable than pasting a 1 MB SQL file into the web editor. Safe
 * to re-run: every table keys on `slug`, so a second run updates rather than
 * duplicates.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
 * .env.local (the npm script passes it via --env-file).
 */
import { createClient } from "@supabase/supabase-js";
import { BUNDLED_CATEGORIES, BUNDLED_SOURCES, getBundledEvents } from "../src/lib/bundled-data";
import { withAllDayTag } from "../src/lib/tags";

const BATCH = 500;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`\n  Missing ${name}.\n`);
    console.error("  Copy .env.example to .env.local and fill in the three");
    console.error("  Supabase values from Project Settings -> API, then re-run.\n");
    process.exit(1);
  }
  return value;
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Fail early and legibly if the project is reachable but the schema isn't there.
  const { error: probe } = await admin.from("events").select("id").limit(1);
  if (probe) {
    console.error(`\n  Could not read the events table: ${probe.message}\n`);
    console.error("  Run supabase/schema.sql in the Supabase SQL editor first.\n");
    process.exit(1);
  }

  const categories = BUNDLED_CATEGORIES.map(({ slug, name, icon, color, sort_order }) => ({
    slug, name, icon, color, sort_order,
  }));
  const { error: catErr } = await admin
    .from("event_categories")
    .upsert(categories, { onConflict: "slug" });
  if (catErr) throw new Error(`categories: ${catErr.message}`);
  console.log(`categories  ${categories.length}`);

  // Provenance for the crawled events. Disabled because the scheduled scraper
  // has no adapter for these keys; the seven live sources in seed.sql are
  // untouched by this upsert.
  // Namespaced: slugify("Pleasanton Weekly") collides with seed.sql's own
  // `pleasanton-weekly`, and an upsert on that slug would overwrite a live
  // scheduled scraper with a disabled provenance row.
  const sources = BUNDLED_SOURCES.map((s) => ({
    slug: `crawl-${s.slug}`,
    name: s.name,
    url: s.url,
    website: s.website,
    scraper_key: `crawl4ai:${s.scraper_key}`,
    strategy: s.strategy,
    enabled: false,
    notes: `One-shot Crawl4AI sweep. ${s.notes ?? ""} No scheduled adapter.`.trim(),
  }));
  // Guard the invariant rather than trusting it.
  const stray = sources.find((s) => !s.slug.startsWith("crawl-"));
  if (stray) throw new Error(`refusing to write outside the crawl- namespace: ${stray.slug}`);

  const { error: srcErr } = await admin.from("sources").upsert(sources, { onConflict: "slug" });
  if (srcErr) throw new Error(`sources: ${srcErr.message}`);
  console.log(`sources     ${sources.length}`);

  // source_id is a uuid the database assigns, so resolve it by slug after insert.
  const { data: dbSources, error: readErr } = await admin.from("sources").select("id, slug");
  if (readErr) throw new Error(`reading sources back: ${readErr.message}`);
  const idBySlug = new Map((dbSources ?? []).map((s) => [s.slug, s.id]));
  const slugByName = new Map(BUNDLED_SOURCES.map((s) => [s.name, `crawl-${s.slug}`]));

  const events = getBundledEvents().map((e) => ({
    title: e.title,
    slug: e.slug,
    description: e.description,
    start_at: e.start_at,
    end_at: e.end_at,
    venue: e.venue,
    address: e.address,
    category: e.category,
    // `all_day` has no column; it rides along as a tag. See src/lib/tags.ts.
    tags: withAllDayTag(e.tags ?? [], e.all_day ?? false),
    price: e.price,
    is_free: e.is_free,
    is_family_friendly: e.is_family_friendly,
    image_url: e.image_url,
    ticket_url: e.ticket_url,
    source_id: idBySlug.get(slugByName.get(e.source_name ?? "") ?? "") ?? null,
    source_url: e.source_url,
    status: "approved",
    origin: "scraper",
    dedupe_hash: e.id,
  }));

  let written = 0;
  for (let i = 0; i < events.length; i += BATCH) {
    const batch = events.slice(i, i + BATCH);
    const { error } = await admin.from("events").upsert(batch, { onConflict: "slug" });
    if (error) throw new Error(`events batch ${i / BATCH + 1}: ${error.message}`);
    written += batch.length;
    process.stdout.write(`\revents      ${written}/${events.length}`);
  }
  console.log("");

  const { count } = await admin
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved");
  console.log(`\nDone. ${count ?? "?"} approved events in the database.`);
  console.log("Restart `npm run dev` — the \"No database connected\" banner should be gone.");
}

main().catch((err) => {
  console.error("\nSeed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
