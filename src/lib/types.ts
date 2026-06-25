// Shared domain types for Pleasanton Events Hub.

export type EventStatus = "pending" | "approved" | "rejected" | "hidden";
export type EventOrigin = "scraper" | "submission" | "manual";

export interface EventCategory {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  sort_order?: number | null;
}

export interface Source {
  id: string;
  slug: string;
  name: string;
  url: string;
  website?: string | null;
  scraper_key: string;
  strategy: "cheerio" | "playwright";
  enabled: boolean;
  notes?: string | null;
  last_run_at?: string | null;
  last_status?: string | null;
}

export interface EventRecord {
  id: string;
  title: string;
  slug?: string | null;
  description?: string | null;
  start_at: string; // ISO timestamp
  end_at?: string | null;
  venue?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  category?: string | null; // category slug
  tags?: string[];
  price?: string | null;
  is_free?: boolean;
  is_family_friendly?: boolean;
  image_url?: string | null;
  ticket_url?: string | null;
  source_id?: string | null;
  source_url?: string | null;
  source_name?: string | null;
  status: EventStatus;
  origin: EventOrigin;
  duplicate_of?: string | null;
  dedupe_hash?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SubmittedEvent {
  id: string;
  title: string;
  description?: string | null;
  event_date: string; // YYYY-MM-DD
  start_time?: string | null;
  end_time?: string | null;
  venue?: string | null;
  address?: string | null;
  category?: string | null;
  image_url?: string | null;
  ticket_url?: string | null;
  contact_email: string;
  is_family_friendly?: boolean;
  price?: string | null;
  status: "pending" | "approved" | "rejected";
  published_event_id?: string | null;
  review_notes?: string | null;
  created_at?: string;
}

export interface ScrapedEventLog {
  id: string;
  source_id?: string | null;
  source_slug?: string | null;
  started_at: string;
  finished_at?: string | null;
  status: "running" | "ok" | "error" | "partial";
  items_found: number;
  items_created: number;
  items_updated: number;
  items_duplicate: number;
  error_message?: string | null;
}

// Shape produced by a scraper before normalization / persistence.
export interface RawScrapedEvent {
  title?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  venue?: string;
  address?: string;
  description?: string;
  image_url?: string;
  source_url?: string;
  category?: string;
  price?: string;
  is_family_friendly?: boolean | string;
}

// Cleaned, structured event ready for dedupe + persistence.
export interface NormalizedEvent {
  title: string;
  description: string | null;
  start_at: string; // ISO
  end_at: string | null;
  venue: string | null;
  address: string | null;
  category: string;
  tags: string[];
  price: string | null;
  is_free: boolean;
  is_family_friendly: boolean;
  image_url: string | null;
  ticket_url: string | null;
  source_url: string | null;
}

export interface EventFilters {
  category?: string;
  search?: string;
  free?: boolean;
  familyFriendly?: boolean;
  from?: string; // ISO date
  to?: string; // ISO date
  location?: string;
}
