# Knowledge base

Everything the **Ask** panel knows lives in this folder as markdown.
`npm run knowledge` compiles it into `src/lib/knowledge.generated.json`, which
the chat's search tool reads at request time. No database or vector store is
involved: the index ships inside the app.

```
knowledge/
  events/   Generated digests, one file per crawled source, one `## ` section
            per event. Rebuilt from data/pleasanton-events.json by
            `npm run knowledge`. Never edit by hand.
  pages/    Raw crawled pages (optional). `scripts/crawl4ai/export_pages.py`
            drops the crawler's markdown here, one folder per source, with a
            frontmatter header. Any markdown file you add here is indexed too.
```

## Adding your own pages

Drop a `.md` file anywhere under `pages/` with a header like this, then run
`npm run knowledge -- --index-only`:

```markdown
---
kind: page
source: Pleasanton Downtown Association
title: First Wednesday street parties
url: https://www.pleasantondowntown.net/first-wednesdays
crawled: 2026-09-03
---

First Wednesday Street Parties return May 6, 2026 …
```

`source`, `title`, and `url` are shown to the model and used for attribution.
`crawled` lets a date like "June 12" (no year) be resolved. The body is split
into ~1,400 character slices; each slice is searchable on its own, and any
dates it mentions let it match "what's on that day" questions.

## How the digests are shaped

```markdown
## Scottish Highland Gathering & Games

- id: 3f2a…
- slug: scottish-highland-gathering-games-3f2a1b
- date: 2026-09-05
- when: Saturday, September 5, 2026, 8:00 AM – 6:00 PM
- venue: Alameda County Fairgrounds
- city: Pleasanton
- category: festival
- price: $20
- free: no
- family_friendly: yes
- url: https://…
- source: Alameda County Fairgrounds

The 160th annual gathering …
```

When Supabase is connected, event sections are replaced at request time by
the live `events` table (rendered into the same shape), so the chat never
answers from a stale bundle while the calendar shows fresh rows. Pages under
`pages/` are always included.
