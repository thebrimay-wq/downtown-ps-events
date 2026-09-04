# Pleasanton Events Hub

A centralized, modern event calendar for **Pleasanton, California**. It
automatically collects local events from public sources, normalizes the messy
scraped text into clean structured data with AI, detects duplicates, and
presents everything in a fast, mobile-first, Apple-inspired interface.

> **Runs with zero setup.** Out of the box the app serves bundled sample events
> so you can explore the full UI immediately. Add Supabase + Anthropic
> credentials to enable persistence, live scraping, and AI normalization.

---

## Features

- **Homepage** — "What's happening in Pleasanton?" hero, search, Today's events,
  This Weekend, and category quick-links.
- **Events page** — list ↔ calendar toggle, sticky filters (category, date,
  free/paid, kid-friendly, location), and search.
- **Event detail** — date/time, location with map link, description, category
  tags, source attribution, and an **Add to calendar** (.ics) button.
- **Submit an event** — a form for businesses & community members.
- **Admin dashboard** — review scraped events, approve/reject/edit, merge
  duplicates, view sources, and monitor scrape-run logs.
- **Scraper system** — configurable per-source adapters with a robust
  extraction cascade (schema.org JSON-LD → microdata → heuristic DOM scan).
- **AI normalization** — Claude turns messy scraped text into clean, structured
  JSON (with a heuristic fallback when no API key is set).
- **Duplicate detection** — exact hashing + fuzzy title/venue/date matching
  flags possible duplicates for review.
- **Scheduled scraping** — GitHub Actions cron and/or Vercel Cron.

## Tech stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres) ·
Cheerio (scraping) · Anthropic Claude (`claude-opus-4-8`) · Vercel / GitHub
Actions (scheduling).

---

## Getting started

```bash
npm install
npm run dev
# open http://localhost:3000  → fully browsable, no setup needed
```

With no database configured the site serves a bundled dataset of **1,529 real
events** (September 2026 → September 2027) crawled from 15 Pleasanton and
Tri-Valley sources. See [`data/CRAWL-REPORT.md`](data/CRAWL-REPORT.md) for
coverage and [`scripts/crawl4ai/`](scripts/crawl4ai/README.md) for the crawler
that produced it.

### Connecting a database

The bundled dataset is read-only. Point the app at Supabase to get
submissions, moderation, and scheduled scraping.

**1. Create the project.** At [supabase.com](https://supabase.com), New
project. Save the database password; pick the region nearest you.

**2. Create the schema.** In the SQL Editor, run `supabase/schema.sql`, then
`supabase/seed.sql`. Both are small and idempotent.

**3. Add your keys.** From Project Settings → API, fill in `.env.local`:

```ini
NEXT_PUBLIC_SUPABASE_URL=        # Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # anon public key — safe in the browser
SUPABASE_SERVICE_ROLE_KEY=       # service_role key — server only, bypasses RLS
ADMIN_SECRET=                    # openssl rand -hex 32
```

**4. Load the events.**

```bash
npm run seed
```

This upserts the categories, the 15 crawl sources, and all 1,529 events in
batches of 500, so the site isn't empty on first load. Safe to re-run — every
table keys on `slug`.

> Prefer pure SQL? `supabase/seed-events.sql` does the same thing, chunked
> into eight statements so the web editor doesn't time out. `npm run seed` is
> the easier path.

**5. Restart.**

```bash
npm run dev
```

The "No database connected" banner disappears and `/admin` goes live.

Two implementation notes. Crawl source slugs are namespaced `crawl-*` so an
upsert can never overwrite a live scraper source from `seed.sql`. And the
`all_day` flag — set on the 209 events whose source published a date but no
time — rides along in the `tags` array rather than its own column, so no
migration is needed; see `src/lib/tags.ts`.

The crawl sources are seeded **disabled** on purpose: they are provenance for
the bundled events, and the scheduled scraper has no adapter for their keys.
The seven live sources from `seed.sql` keep running.

### Enabling the database & scraping

### Enabling the database & scraping

1. Create a [Supabase](https://supabase.com) project.
2. In the SQL editor, run `supabase/schema.sql` then `supabase/seed.sql`.
3. Copy `.env.example` → `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
   - `ANTHROPIC_API_KEY` (optional — enables AI normalization)
   - `ADMIN_SECRET` (`openssl rand -hex 32`) — gates scraping + admin actions
4. Restart `npm run dev`. The app now reads/writes Supabase.

### Running the scraper

```bash
npm run scrape          # reads enabled sources, scrapes, normalizes, dedupes
```

New events are inserted with `status = 'pending'` and appear in the **Admin →
Scraped events** tab for approval. Approved events become visible site-wide.

You can also trigger a run from the admin dashboard (enter your `ADMIN_SECRET`
and click **Run scrapers now**) or via the API:

```bash
curl -X POST https://your-site/api/scrape -H "x-admin-secret: $ADMIN_SECRET"
```

---

## Architecture

```
src/
  app/                      Next.js App Router
    page.tsx                Homepage
    events/                 List/calendar + detail pages
    submit/                 Submission form
    admin/                  Moderation dashboard
    api/                    submit · scrape · events · admin/{events,submissions}
  components/               UI: cards, filters, calendar, header/footer, admin
  lib/
    data.ts                 Read layer (Supabase, falling back to the bundle)
    bundled-data.ts         Bundled crawl results (used when Supabase is absent)
    *.generated.json        Crawler output — regenerate, don't hand-edit
    supabase/               Browser/server/admin clients
    scrapers/               Fetch + extraction engine + per-source adapters
    ai/normalize.ts         Claude normalization (+ heuristic fallback)
    dedupe.ts               Hashing + fuzzy duplicate detection
    types.ts, utils.ts, categories.ts
supabase/                   schema.sql + seed.sql
scripts/run-scrapers.ts     CLI scrape entry point
scripts/crawl4ai/           Wide one-shot Crawl4AI sweep → bundled dataset
data/                       Crawl archive + coverage report
.github/workflows/scrape.yml  Scheduled scrape
vercel.json                 Vercel Cron config
```

### Data model

| Table                | Purpose                                          |
| -------------------- | ------------------------------------------------ |
| `events`             | Canonical published/pending events               |
| `sources`            | Configurable scrape targets                      |
| `event_categories`   | Controlled category vocabulary                   |
| `submitted_events`   | Community submissions awaiting review            |
| `scraped_event_logs` | Audit trail of every scrape run                  |

### Scrape sources (seeded)

Pleasanton Downtown Association · Pleasanton Farmers Market · City of
Pleasanton · Hacienda · Eventbrite (Pleasanton) · Bandsintown (Pleasanton) ·
Pleasanton Weekly calendar.

Add or disable sources by editing the `sources` table — no code changes needed
unless a site requires a new extraction adapter (add one under
`src/lib/scrapers/sources/` and register it in `src/lib/scrapers/index.ts`).

---

## Scheduling

- **GitHub Actions** (`.github/workflows/scrape.yml`): runs daily at 09:00 UTC.
  Add repo secrets `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  and (optionally) `ANTHROPIC_API_KEY`.
- **Vercel Cron** (`vercel.json`): hits `GET /api/scrape` daily. Set a
  `CRON_SECRET` env var in Vercel equal to your `ADMIN_SECRET` — Vercel sends it
  as a `Bearer` token, which the endpoint validates.

---

## Notes on responsible scraping

The scraper sends a descriptive User-Agent, fetches each source page once per
run, and times out gracefully. Respect each source's terms of service and
`robots.txt`; this project is intended for non-commercial community use.
