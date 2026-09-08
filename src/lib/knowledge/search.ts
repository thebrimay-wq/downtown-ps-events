import "server-only";
import index from "../knowledge.generated.json";
import { getEvents } from "../data";
import { isSupabaseConfigured } from "../supabase/env";
import { eventToChunk } from "./render";
import {
  buildCorpus,
  searchCorpus,
  type Corpus,
  type SearchParams,
  type SearchResponse,
} from "./engine";
import type { KnowledgeChunk, KnowledgeIndex } from "./types";

export type { SearchParams, SearchResponse } from "./engine";
export { MAX_RESULTS } from "./engine";

// ---------------------------------------------------------------------------
// Where the chat's search corpus comes from. The corpus is built once per
// server instance and reused. When Supabase is connected, the event chunks
// come from the live table (re-read every few minutes) instead of the bundled
// digests, so answers track the calendar; raw pages are always included.
// ---------------------------------------------------------------------------

const BUNDLED = index as KnowledgeIndex;
const LIVE_TTL_MS = 5 * 60 * 1000;

let corpus: Corpus | null = null;
let building: Promise<Corpus> | null = null;

async function loadChunks(): Promise<KnowledgeChunk[]> {
  if (!isSupabaseConfigured) return BUNDLED.chunks;
  const events = await getEvents({}, { upcomingOnly: false });
  if (events.length === 0) return BUNDLED.chunks;
  const pages = BUNDLED.chunks.filter((c) => c.kind === "page");
  return [...events.map((e) => eventToChunk(e, "supabase:events")), ...pages];
}

export async function getCorpus(): Promise<Corpus> {
  const stale =
    corpus && isSupabaseConfigured && Date.now() - corpus.builtAt > LIVE_TTL_MS;
  if (corpus && !stale) return corpus;
  if (!building) {
    building = loadChunks()
      .then((chunks) => {
        corpus = buildCorpus(chunks);
        return corpus;
      })
      .finally(() => {
        building = null;
      });
  }
  // While a refresh is in flight, keep serving the previous corpus.
  return corpus ?? building;
}

// Earliest and latest day the knowledge base covers.
export async function coverageWindow(): Promise<{
  start: string | null;
  end: string | null;
}> {
  return (await getCorpus()).window;
}

export async function searchKnowledge(params: SearchParams): Promise<SearchResponse> {
  return searchCorpus(await getCorpus(), params);
}
