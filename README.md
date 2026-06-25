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
# open http://localhost:3000  → fully browsable in demo mode
```

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
    data.ts                 Read layer (Supabase, with mock fallback)
    mock-data.ts            Bundled demo events (used when Supabase is absent)
    supabase/               Browser/server/admin clients
    scrapers/               Fetch + extraction engine + per-source adapters
    ai/normalize.ts         Claude normalization (+ heuristic fallback)
    dedupe.ts               Hashing + fuzzy duplicate detection
    types.ts, utils.ts, categories.ts
supabase/                   schema.sql + seed.sql
scripts/run-scrapers.ts     CLI scrape entry point
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
