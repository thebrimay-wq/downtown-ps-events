# Pleasanton event crawler (Crawl4AI)

A one-shot crawl of Pleasanton + Tri-Valley event sources. It is separate from
the TypeScript scraper in `src/lib/scrapers/` — that one writes into Supabase
on a schedule; this one is a wide, ad-hoc sweep whose output the app serves
whenever no database is configured.

`emit.py` writes five files:

| File | Used by |
|---|---|
| `data/pleasanton-events.json` | Archive — every field, including provenance |
| `data/CRAWL-REPORT.md` | Human-readable coverage report |
| `src/lib/events.generated.json` | The app, via `src/lib/bundled-data.ts` |
| `src/lib/sources.generated.json` | The app's source list — only sources that were reachable *and* produced events |
| `src/lib/dataset-meta.generated.json` | The "no database connected" banner |

## Run

```bash
pip install --user crawl4ai python-dateutil
crawl4ai-setup                 # installs the Playwright browser

python3 scripts/crawl4ai/run_crawl.py    # round 1 — 102 pages
python3 scripts/crawl4ai/run_crawl2.py   # round 2 — 158 gap-fill pages (JS-heavy)
python3 scripts/crawl4ai/build_events.py # parse, normalize, filter, dedupe
python3 scripts/crawl4ai/harvest_images.py # fetch each event page's artwork (slow)
python3 scripts/crawl4ai/apply_images.py   # merge artwork; category photo for the rest
python3 scripts/crawl4ai/emit.py         # write data/ + src/lib/ artefacts
python3 scripts/crawl4ai/seed_sql.py     # write supabase/seed-events.sql
```

Both crawl rounds append to `manifest.json` and drop raw HTML + markdown in
`pages/`, so `build_events.py` can be re-run without re-fetching.

## Files

| File | Role |
|---|---|
| `worklist.py` | Round-1 URLs: static pages, month archives, per-event pages, REST APIs |
| `worklist2.py` | Round-2 URLs: JS-rendered calendars and real pagination found in round 1 |
| `run_crawl.py` / `run_crawl2.py` | Crawl4AI drivers (`arun_many`, concurrency 5) |
| `extract.py` | Per-site parsers — see below |
| `build_events.py` | Normalization: dates, categories, geography, dedupe |
| `harvest_images.py` | Visits each event's own page for its `og:image` (sources with per-event URLs only) |
| `apply_images.py` | Merges harvested artwork; events with none get a category photo chosen by id |
| `emit.py` | Writes `data/pleasanton-events.json` + `data/CRAWL-REPORT.md` |
| `seed_sql.py` | Writes `supabase/seed-events.sql` so a fresh database matches the bundle |

## Extraction strategies

Ordered by how much we trust them:

1. **`tribe_api`** — The Events Calendar REST API (`/wp-json/tribe/events/v1/events`).
   Structured, covers the full year in one call. Only Firehouse Arts exposes it.
2. **`jsonld`** — schema.org `Event` nodes. Eventbrite, AllEvents, McGrail.
3. **Site-specific markdown parsers** — `lvwine`, `vibe`, `acfair`, `pda`,
   `patch`, `pweekly`, `bankhead`. Several of these recover the date from the
   event URL (`…/event/slug-2026-11-21/`), which is far more reliable than
   parsing rendered date text.
4. **`generic`** — JSON-LD first, then a conservative heading-plus-nearby-date
   scan. Last resort.

## Geography

The regional aggregators return events from across the East Bay, so
`build_events.py` classifies every event by address → venue → URL → title, in
that order, and keeps only Pleasanton and the rest of the Tri-Valley
(Livermore, Dublin, San Ramon, Danville, Sunol). Everything else is dropped
and counted in the report.

## Images

Every event ships with an `image_url`. Where it came from is recorded in the
archive's `image_source` field: `listing` (the source page carried it),
`event-page` (fetched from the event's own page), or `category-stock` (an
Unsplash photo picked per category, deterministic by event id). Bankhead's
artwork is only published at 160×90, so it will look soft at card size.

## Known gaps

- **City of Pleasanton, the library, and Pleasanton Recreation** render their
  calendars from JS with no reachable feed or API. They need either a
  `js_code` interaction or an official iCal/ActiveNet feed.
- **DoTheBay** is excluded: its venue pages render the site-wide "popular in
  the Bay Area" list under the venue's heading, so its rows are San Francisco
  shows, not Pleasanton ones.
- **Ruby Hill Winery** (Pleasanton) loads events through Commerce7 after page
  load; nothing was captured.
- Listings thin out past roughly four months — that is the sources' own
  horizon, not a crawl limit.
