// ---------------------------------------------------------------------------
// Markers carried inside an event's `tags` array rather than as their own
// columns. `tags text[]` already exists and already round-trips through
// Supabase, so a marker stored here needs no migration — and iCal models
// all-day events the same way (DTSTART;VALUE=DATE carries no time).
//
// These are machine markers, not descriptive tags, so they are hidden from the
// tag list the reader sees and excluded from free-text search.
// ---------------------------------------------------------------------------

// The source published a date with no time; start_at's time is a placeholder.
export const ALL_DAY_TAG = "all-day";

// Which broad area an event sits in. The Location fact already says this.
export const REGION_TAGS = ["pleasanton", "tri-valley"] as const;

const HIDDEN = new Set<string>([ALL_DAY_TAG, ...REGION_TAGS]);

export function hasAllDayTag(tags?: string[] | null): boolean {
  return (tags ?? []).includes(ALL_DAY_TAG);
}

export function withAllDayTag(tags: string[], allDay: boolean): string[] {
  const rest = tags.filter((t) => t !== ALL_DAY_TAG);
  return allDay ? [...rest, ALL_DAY_TAG] : rest;
}

// The tags worth showing a reader, or matching a search against.
export function visibleTags(tags?: string[] | null): string[] {
  return (tags ?? []).filter((t) => !HIDDEN.has(t));
}
