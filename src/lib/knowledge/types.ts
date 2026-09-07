// ---------------------------------------------------------------------------
// The chat's knowledge base is a folder of markdown files (knowledge/). Those
// files are compiled into a flat list of chunks, and a chunk is the unit that
// search returns and the model reads. Two kinds exist:
//
//   event  — one section of a generated digest (knowledge/events/*.md); it
//            carries structured fields (date, venue, city…) so questions like
//            "what's on Saturday" can be answered by filtering, not guessing.
//   page   — a slice of a raw crawled page (knowledge/pages/**.md); free text
//            with any dates it mentions pulled out for coarse date filtering.
// ---------------------------------------------------------------------------

export type ChunkKind = "event" | "page";

export interface KnowledgeChunk {
  // Stable id: the event id, or `<doc>#<n>` for a page slice.
  id: string;
  kind: ChunkKind;
  // Markdown file the chunk came from, relative to knowledge/.
  doc: string;
  // Human name of the site the content was crawled from.
  source: string;
  // Where a reader can see the original.
  url: string | null;
  title: string;
  // Local (America/Los_Angeles) calendar dates, YYYY-MM-DD. Pages carry the
  // earliest and latest date they mention; events carry their start day.
  date: string | null;
  end_date: string | null;
  // Fields only event chunks fill in.
  start_at: string | null;
  end_at: string | null;
  all_day: boolean;
  venue: string | null;
  address: string | null;
  city: string | null;
  category: string | null;
  price: string | null;
  is_free: boolean;
  is_family_friendly: boolean;
  // Site-internal path for the event page, e.g. /events/<slug>.
  link: string | null;
  // The body: an event's description, or the page slice itself.
  text: string;
}

export interface KnowledgeIndex {
  generated_at: string;
  documents: number;
  chunks: KnowledgeChunk[];
}
