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
- **Ask the calendar** — a chat panel, opened from the floating **Ask**
  button on every page, that answers "what's going on this weekend?",
  "anything for kids on the 12th?", or "what's at the Firehouse?" from a
  markdown knowledge base built out of the crawled listings, with links to
  every event it names.

## Tech stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres) ·
Cheerio (scraping) · Anthropic Claude (`claude-opus-4-8` for normalization,
`claude-opus-5` for the Ask page) · Cloudflare Workers
(hosting) · GitHub Actions (scheduling).

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

1. Create a [Supabase](https://supabase.com) project.
2. In the SQL editor, run `supabase/schema.sql` then `supabase/seed.sql`.
3. Copy `.env.example` → `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
   - `ANTHROPIC_API_KEY` (optional — enables AI normalization)
   - `ADMIN_SECRET` (`openssl rand -hex 32`) — gates scraping + admin actions
4. Restart `npm run dev`. The app now reads/writes Supabase.

### Enabling the Ask panel

The **Ask** button (bottom right of every page) works out of the box as a
keyword search over the listings. Set `ANTHROPIC_API_KEY` (the same key that
powers scrape normalization) and it becomes a conversation: Claude reads the question, works out the dates
("this weekend", "next Friday", "in October"), runs one or more searches over
the knowledge base, and answers with linked events. Nothing is answered from
memory: every event it names came back from a search.

```ini
ANTHROPIC_API_KEY=            # enables AI answers in the Ask panel
ANTHROPIC_CHAT_MODEL=claude-opus-5   # optional
ANTHROPIC_CHAT_EFFORT=medium         # optional: low · medium · high · xhigh · max
```

How it fits together:

```
knowledge/                    Markdown knowledge base (see knowledge/README.md)
  events/*.md                 One digest per crawled source, one section per event
  pages/**/*.md               Raw crawled pages, optional
        │  npm run knowledge
        ▼
src/lib/knowledge.generated.json   Chunk index bundled with the app
        │
        ▼
src/lib/knowledge/            engine.ts: date/city/category filters + BM25 keywords
                              search.ts: bundled index, or live Supabase events
        │
        ▼
src/lib/ai/chat.ts            Claude + one tool (search_events), streamed
src/app/api/chat/route.ts     POST {messages} → newline-delimited JSON events
src/components/ask-panel.tsx  Floating button + slide-in panel (ask-chat.tsx inside)
```

When Supabase is connected the event sections are replaced at request time by
the live `events` table, so the chat and the calendar always agree. Raw pages
under `knowledge/pages/` are indexed either way.

To feed the chat more than the event digests, run the crawl (see
`scripts/crawl4ai/README.md`), then:

```bash
python3 scripts/crawl4ai/export_pages.py   # raw page markdown → knowledge/pages/
npm run knowledge                          # rebuild digests + index
```

The API route is public and calls Claude on every question, so it caps
message length and history, and rate-limits each IP to 30 questions per ten
minutes per server instance.

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

## Deploying to Cloudflare

The site runs as a single Cloudflare Worker, built by
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare). The Worker is
named `downtown-ps-events` in [`wrangler.jsonc`](wrangler.jsonc); rename it
there if you want a different `*.workers.dev` hostname.

### From your machine

```bash
npx wrangler login      # once
npm run deploy          # builds the Worker and uploads it
```

Then give the Worker its secrets. Values are read from `.env.local`, so fill
that in first:

```bash
for k in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY ADMIN_SECRET ANTHROPIC_API_KEY; do
  v=$(grep "^$k=" .env.local | cut -d= -f2-)
  [ -n "$v" ] && printf '%s' "$v" | npx wrangler secret put "$k"
done
```

Secrets persist across deploys. `NEXT_PUBLIC_SITE_URL` is a plain var in
`wrangler.jsonc`; change it there when you attach a custom domain.

`npm run preview` runs the built Worker locally under `wrangler dev`, which is
the closest thing to production. `npm run dev` still works for day-to-day
development.

### On every push (GitHub Actions)

`.github/workflows/deploy.yml` builds the Worker and uploads it whenever
`main` or `claude/pleasanton-events-hub-dvwuym` changes, and can be run by
hand from the Actions tab. It needs two repository secrets (GitHub →
Settings → Secrets and variables → Actions):

| Secret | Where to get it |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare → Workers & Pages, right-hand column of the overview |

After each deploy the workflow copies any of `ANTHROPIC_API_KEY`,
`ADMIN_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
and `SUPABASE_SERVICE_ROLE_KEY` that exist as repository secrets onto the
Worker, so adding `ANTHROPIC_API_KEY` there is all it takes to switch on
AI answers in the Ask panel.

### On every push (Workers Builds, the alternative)

In the Cloudflare dashboard open the Worker → **Settings → Build** and connect
the GitHub repository. The "Cloudflare Workers and Pages" GitHub App must
have access to this repository (GitHub → Settings → Applications), or pushes
never reach Cloudflare and the Build settings show "disconnected from your
Git account". The defaults then work as they are:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` (the default) |
| Deploy command | `npx wrangler deploy` (the default) |
| Build variables | none needed |

`npm run build` runs the OpenNext build, which wraps `next build` and emits
the Worker under `.open-next/`. `npm run build:next` is the plain Next build.
All environment values are read at request time from the Worker's secrets
(Settings → Variables & Secrets), so the build needs none of them.

### What changes on Cloudflare

- **Plan.** Every page fetches all approved events from Supabase and filters
  them in memory. Parsing that response costs about 7 ms of CPU before React
  renders anything, and the Workers free plan allows 10 ms per request. On the
  free plan most routes fail with Cloudflare error 1102. Move the account to
  Workers Paid (30 s of CPU per request) or cut the per-request data volume.
- **Caching.** Routes marked `revalidate` render on each request. No
  incremental cache is configured, which keeps the setup free of extra
  resources. For edge caching, enable R2 in the dashboard and switch
  `open-next.config.ts` to `r2IncrementalCache`.
- **Scheduling.** `vercel.json` does nothing here. Scheduled scraping runs
  from `.github/workflows/scrape.yml`; keep that as the scheduler.
- **Bundled env.** A local `npm run deploy` copies the values in `.env.local`
  into the Worker bundle, where Worker secrets override them. Rotate a secret
  with `wrangler secret put` and redeploy to purge the old copy.

---

## Architecture

```
src/
  app/                      Next.js App Router
    page.tsx                Homepage
    events/                 List/calendar + detail pages
    submit/                 Submission form
    admin/                  Moderation dashboard
    api/                    submit · scrape · events · chat · admin/{events,submissions}
  components/               UI: cards, filters, calendar, header/footer, admin, Ask panel
  lib/
    data.ts                 Read layer (Supabase, falling back to the bundle)
    bundled-data.ts         Bundled crawl results (used when Supabase is absent)
    *.generated.json        Crawler output — regenerate, don't hand-edit
    supabase/               Browser/server/admin clients
    scrapers/               Fetch + extraction engine + per-source adapters
    ai/normalize.ts         Claude normalization (+ heuristic fallback)
    ai/chat.ts              The Ask assistant: Claude + search_events tool, streamed
    knowledge/              Markdown → chunks (parse.ts), search (engine.ts, search.ts)
    knowledge.generated.json  Compiled knowledge index — npm run knowledge
    dedupe.ts               Hashing + fuzzy duplicate detection
    types.ts, utils.ts, categories.ts
supabase/                   schema.sql + seed.sql
scripts/run-scrapers.ts     CLI scrape entry point
scripts/build-knowledge.ts  Renders knowledge/events/*.md and compiles the index
knowledge/                  Markdown knowledge base for the Ask page
scripts/crawl4ai/           Wide one-shot Crawl4AI sweep → bundled dataset
data/                       Crawl archive + coverage report
.github/workflows/scrape.yml  Scheduled scrape
wrangler.jsonc              Cloudflare Worker config
open-next.config.ts         OpenNext (Next.js → Worker) adapter config
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
- **Any external cron** can hit `GET /api/scrape` with
  `Authorization: Bearer $ADMIN_SECRET`. `vercel.json` shows the shape but
  does nothing on Cloudflare.

---

## Notes on responsible scraping

The scraper sends a descriptive User-Agent, fetches each source page once per
run, and times out gracefully. Respect each source's terms of service and
`robots.txt`; this project is intended for non-commercial community use.
