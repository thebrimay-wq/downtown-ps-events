import { createHash } from "node:crypto";
import type { NormalizedEvent } from "./types";

// ---------------------------------------------------------------------------
// Duplicate detection. Two events are likely the same if they share a date and
// venue and have similar titles. We compute a stable hash for exact matches and
// a fuzzy similarity score for near matches.
// ---------------------------------------------------------------------------

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an|at|in|on|of|and|with|to|for)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function localDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
  }).format(new Date(iso));
}

// Stable hash of the key identity fields — title + day + venue.
export function dedupeHash(e: {
  title: string;
  start_at: string;
  venue?: string | null;
}): string {
  const key = [
    normalizeText(e.title),
    localDay(e.start_at),
    normalizeText(e.venue ?? ""),
  ].join("|");
  return createHash("sha1").update(key).digest("hex");
}

// Jaccard similarity over word sets — cheap and good enough for event titles.
function jaccard(a: string, b: string): number {
  const setA = new Set(normalizeText(a).split(" ").filter(Boolean));
  const setB = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  return intersection / (setA.size + setB.size - intersection);
}

export interface DuplicateMatch {
  isDuplicate: boolean;
  score: number;
  reason: string;
}

// Compare a candidate against an existing event. Same-day + same-venue + a
// reasonably similar title flags a possible duplicate for human review.
export function compareEvents(
  candidate: NormalizedEvent,
  existing: { title: string; start_at: string; venue?: string | null },
): DuplicateMatch {
  const sameDay = localDay(candidate.start_at) === localDay(existing.start_at);
  if (!sameDay) return { isDuplicate: false, score: 0, reason: "different day" };

  const titleScore = jaccard(candidate.title, existing.title);
  const venueScore =
    candidate.venue && existing.venue
      ? jaccard(candidate.venue, existing.venue)
      : 0;

  // Same day + strong title match → duplicate. Same day + same venue + a
  // moderate title match → also a duplicate.
  const strongTitle = titleScore >= 0.6;
  const venueAndTitle = venueScore >= 0.5 && titleScore >= 0.35;
  const isDuplicate = strongTitle || venueAndTitle;

  const score = Math.max(titleScore, (titleScore + venueScore) / 2);
  return {
    isDuplicate,
    score,
    reason: isDuplicate
      ? `same day, title~${titleScore.toFixed(2)} venue~${venueScore.toFixed(2)}`
      : "below threshold",
  };
}
