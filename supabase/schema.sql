-- ============================================================================
-- Pleasanton Events Hub — Supabase schema
-- ============================================================================
-- Run this in the Supabase SQL editor (or via `supabase db push`) to provision
-- the database. Safe to re-run: uses IF NOT EXISTS / idempotent inserts.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- event_categories: the controlled vocabulary used to tag events.
-- ----------------------------------------------------------------------------
create table if not exists event_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  color       text default '#d9791f', -- hex used for chips in the UI
  icon        text,                   -- emoji shown alongside the label
  sort_order  int default 100,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- sources: configurable scrape targets.
-- ----------------------------------------------------------------------------
create table if not exists sources (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  name         text not null,
  url          text not null,           -- page the scraper fetches
  website      text,                    -- human-facing homepage
  -- which built-in scraper adapter handles this source
  scraper_key  text not null,
  -- 'cheerio' (static HTML fetch) or 'playwright' (JS-rendered)
  strategy     text not null default 'cheerio',
  enabled      boolean not null default true,
  notes        text,
  last_run_at  timestamptz,
  last_status  text,                    -- 'ok' | 'error' | 'partial'
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- events: the canonical, published event records shown on the site.
-- ----------------------------------------------------------------------------
create table if not exists events (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  slug               text unique,
  description        text,
  start_at           timestamptz not null,
  end_at             timestamptz,
  -- denormalized local-day for fast "today / this weekend" filtering
  start_date         date generated always as ((start_at at time zone 'America/Los_Angeles')::date) stored,
  venue              text,
  address            text,
  latitude           double precision,
  longitude          double precision,
  category           text,             -- slug into event_categories
  tags               text[] default '{}',
  price              text,             -- free-form: 'Free', '$10', '$5-$20'
  is_free            boolean default false,
  is_family_friendly boolean default false,
  image_url          text,
  ticket_url         text,
  source_id          uuid references sources(id) on delete set null,
  source_url         text,             -- original event URL
  status             text not null default 'pending', -- pending|approved|rejected|hidden
  -- 'scraper' | 'submission' | 'manual'
  origin             text not null default 'scraper',
  duplicate_of       uuid references events(id) on delete set null,
  -- stable hash of title+date+venue for dedupe
  dedupe_hash        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists events_start_at_idx on events (start_at);
create index if not exists events_start_date_idx on events (start_date);
create index if not exists events_status_idx on events (status);
create index if not exists events_category_idx on events (category);
create index if not exists events_dedupe_hash_idx on events (dedupe_hash);

-- ----------------------------------------------------------------------------
-- submitted_events: community / business submissions awaiting review.
-- ----------------------------------------------------------------------------
create table if not exists submitted_events (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  description        text,
  event_date         date not null,
  start_time         text,            -- 'HH:MM'
  end_time           text,
  venue              text,
  address            text,
  category           text,
  image_url          text,
  ticket_url         text,
  contact_email      text not null,
  is_family_friendly boolean default false,
  price              text,
  status             text not null default 'pending', -- pending|approved|rejected
  -- if approved & published, points at the created events row
  published_event_id uuid references events(id) on delete set null,
  review_notes       text,
  created_at         timestamptz not null default now()
);

create index if not exists submitted_events_status_idx on submitted_events (status);

-- ----------------------------------------------------------------------------
-- scraped_event_logs: audit trail of every scrape run.
-- ----------------------------------------------------------------------------
create table if not exists scraped_event_logs (
  id              uuid primary key default gen_random_uuid(),
  source_id       uuid references sources(id) on delete set null,
  source_slug     text,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  status          text not null default 'running', -- running|ok|error|partial
  items_found     int default 0,
  items_created   int default 0,
  items_updated   int default 0,
  items_duplicate int default 0,
  error_message   text,
  raw_sample      jsonb            -- a sample of raw scraped payloads for debugging
);

create index if not exists scraped_event_logs_source_idx on scraped_event_logs (source_id);
create index if not exists scraped_event_logs_started_idx on scraped_event_logs (started_at desc);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
-- Public read access to approved content; all writes go through the service
-- role key (used server-side by the scraper and admin API).
-- ----------------------------------------------------------------------------
alter table events enable row level security;
alter table event_categories enable row level security;
alter table sources enable row level security;
alter table submitted_events enable row level security;
alter table scraped_event_logs enable row level security;

drop policy if exists "public read approved events" on events;
create policy "public read approved events" on events
  for select using (status = 'approved');

drop policy if exists "public read categories" on event_categories;
create policy "public read categories" on event_categories
  for select using (true);

drop policy if exists "public read sources" on sources;
create policy "public read sources" on sources
  for select using (true);

-- Anyone may submit an event (insert only) into submitted_events.
drop policy if exists "public submit events" on submitted_events;
create policy "public submit events" on submitted_events
  for insert with check (true);

-- ----------------------------------------------------------------------------
-- updated_at trigger
-- ----------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists events_set_updated_at on events;
create trigger events_set_updated_at before update on events
  for each row execute function set_updated_at();

drop trigger if exists sources_set_updated_at on sources;
create trigger sources_set_updated_at before update on sources
  for each row execute function set_updated_at();
