import { TRI_VALLEY_CITIES } from "./render";
import type { KnowledgeChunk } from "./types";

// ---------------------------------------------------------------------------
// Search over the knowledge base. Two signals, combined:
//
//   * structured filters: date range, city, category, straight off the
//     chunk's fields — this is what makes "what's on Saturday" exact;
//   * keyword relevance: BM25 over the chunk's words, with prefix expansion
//     so "wine" finds "winery" and "wines".
//
// This file is pure: it takes a list of chunks and answers queries. search.ts
// decides where the chunks come from (the bundled index or live Supabase rows).
// ---------------------------------------------------------------------------

export interface SearchParams {
  query?: string | null;
  from?: string | null; // YYYY-MM-DD inclusive
  to?: string | null; // YYYY-MM-DD inclusive
  city?: string | null;
  category?: string | null;
  // Only free listings; only family-friendly ones; only event chunks (no
  // raw page slices).
  free?: boolean | null;
  family?: boolean | null;
  eventsOnly?: boolean | null;
  // With a query: drop matches scoring below this fraction of the best one,
  // so a search for a venue name does not also count everything that shares
  // a word with it. 0 (the default) keeps every match.
  minRelevance?: number | null;
  limit?: number | null;
}

export interface SearchResponse {
  total: number;
  pleasanton: number;
  byDay: Record<string, number>;
  results: KnowledgeChunk[];
}

export const MAX_RESULTS = 80;
const DEFAULT_RESULTS = 40;

// --- Tokenizing -------------------------------------------------------------

const STOP = new Set(
  "a an and are as at be by for from in into is it of on or that the this to with what whats where when who how any some there".split(" "),
);

function stem(t: string): string {
  if (t.length > 4 && t.endsWith("ies")) return `${t.slice(0, -3)}y`;
  if (t.length > 4 && t.endsWith("ing")) return t.slice(0, -3);
  if (t.length > 3 && t.endsWith("es")) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith("s")) return t.slice(0, -1);
  return t;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]s\b/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem);
}

function chunkTokens(c: KnowledgeChunk): string[] {
  // The title is what people ask for by name, so it is counted three times.
  const title = tokenize(c.title);
  return [
    ...title,
    ...title,
    ...title,
    ...tokenize(
      [c.venue, c.address, c.category, c.source, c.price, c.text]
        .filter(Boolean)
        .join(" "),
    ),
  ];
}

// --- Corpus -----------------------------------------------------------------

export interface Corpus {
  chunks: KnowledgeChunk[];
  tf: Map<string, number>[];
  lengths: number[];
  avgLength: number;
  df: Map<string, number>;
  vocab: string[]; // sorted, for prefix expansion
  builtAt: number;
  window: { start: string | null; end: string | null };
}

export function buildCorpus(chunks: KnowledgeChunk[]): Corpus {
  const tf: Map<string, number>[] = [];
  const lengths: number[] = [];
  const df = new Map<string, number>();
  for (const c of chunks) {
    const counts = new Map<string, number>();
    const tokens = chunkTokens(c);
    for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
    for (const t of counts.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    tf.push(counts);
    lengths.push(tokens.length);
  }
  const dated = chunks.map((c) => c.date).filter((d): d is string => Boolean(d)).sort();
  return {
    chunks,
    tf,
    lengths,
    avgLength: lengths.reduce((a, b) => a + b, 0) / Math.max(lengths.length, 1),
    df,
    vocab: [...df.keys()].sort(),
    builtAt: Date.now(),
    window: { start: dated[0] ?? null, end: dated[dated.length - 1] ?? null },
  };
}

// --- Scoring ----------------------------------------------------------------

const K1 = 1.4;
const B = 0.6;
const MAX_EXPANSIONS = 25;

// Every vocabulary word that starts with the query word (for words of four
// or more letters); the word itself always counts.
function expand(term: string, vocab: string[]): string[] {
  if (term.length < 4) return [term];
  let lo = 0;
  let hi = vocab.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (vocab[mid] < term) lo = mid + 1;
    else hi = mid;
  }
  const out: string[] = [];
  for (let i = lo; i < vocab.length && vocab[i].startsWith(term); i++) {
    out.push(vocab[i]);
    if (out.length >= MAX_EXPANSIONS) break;
  }
  return out.length ? out : [term];
}

interface Scored {
  scores: Float64Array;
  // How many distinct query words each chunk hit, and how many there were.
  matched: Uint16Array;
  terms: number;
  // Whether each chunk hit the rarest (most specific) query word.
  rare: Uint8Array;
}

function bm25(corpus: Corpus, query: string): Scored {
  const N = corpus.chunks.length;
  const scores = new Float64Array(N);
  const matched = new Uint16Array(N); // distinct query words each chunk hit
  const terms = [...new Set(tokenize(query))];
  let rare = new Uint8Array(N);
  let rareIdf = -1;
  for (const term of terms) {
    const variants = expand(term, corpus.vocab);
    const hit = new Uint8Array(N);
    const df = variants.reduce((sum, v) => sum + (corpus.df.get(v) ?? 0), 0);
    const termIdf = df ? Math.log(1 + (N - df + 0.5) / (df + 0.5)) : -1;
    // An exact word is worth more than a prefix cousin.
    for (const v of variants) {
      const df = corpus.df.get(v);
      if (!df) continue;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      const weight = v === term ? 1 : 0.6;
      for (let i = 0; i < N; i++) {
        const f = corpus.tf[i].get(v);
        if (!f) continue;
        const norm = f + K1 * (1 - B + (B * corpus.lengths[i]) / corpus.avgLength);
        scores[i] += weight * idf * ((f * (K1 + 1)) / norm);
        hit[i] = 1;
      }
    }
    for (let i = 0; i < N; i++) matched[i] += hit[i];
    if (termIdf > rareIdf) {
      rareIdf = termIdf;
      rare = hit;
    }
  }
  // Matching every word of the question beats matching one word many times,
  // and the exact phrase in a title or venue beats everything.
  const phrase = query.trim().toLowerCase();
  for (let i = 0; i < N; i++) {
    if (scores[i] <= 0) continue;
    if (terms.length > 1) scores[i] *= 1 + matched[i] / terms.length;
    const c = corpus.chunks[i];
    const named = `${c.title} ${c.venue ?? ""}`.toLowerCase();
    if (phrase.length >= 4 && named.includes(phrase)) scores[i] *= 2;
  }
  return { scores, matched, terms: terms.length, rare };
}

// --- Search -----------------------------------------------------------------

function normalizeCity(city: string | null | undefined): string | null {
  if (!city) return null;
  const c = city.trim().toLowerCase();
  return TRI_VALLEY_CITIES.find((name) => name.toLowerCase() === c) ?? null;
}

function overlaps(c: KnowledgeChunk, from: string | null, to: string | null): boolean {
  if (!c.date) return false;
  const start = c.date;
  const end = c.end_date ?? c.date;
  if (from && end < from) return false;
  if (to && start > to) return false;
  return true;
}

export function searchCorpus(corpus: Corpus, params: SearchParams): SearchResponse {
  const query = params.query?.trim() || null;
  const from = params.from?.trim() || null;
  const to = params.to?.trim() || null;
  const city = normalizeCity(params.city);
  const category = params.category?.trim().toLowerCase() || null;
  const limit = Math.min(Math.max(params.limit ?? DEFAULT_RESULTS, 1), MAX_RESULTS);

  const scored = query ? bm25(corpus, query) : null;
  const scores = scored?.scores ?? null;

  const matches: { chunk: KnowledgeChunk; score: number; full: boolean; rare: boolean }[] = [];
  corpus.chunks.forEach((chunk, i) => {
    if (params.eventsOnly && chunk.kind !== "event") return;
    if (city && chunk.city !== city) return;
    if (category && chunk.category !== category) return;
    if (params.free && !chunk.is_free) return;
    if (params.family && !(chunk.is_family_friendly || chunk.category === "family")) return;
    if ((from || to) && !overlaps(chunk, from, to)) return;
    if (scores) {
      const s = scores[i];
      if (s <= 0) return;
      // A Pleasanton listing edges out an identical one from a town over.
      matches.push({
        chunk,
        score: chunk.city === "Pleasanton" ? s * 1.15 : s,
        full: scored!.matched[i] === scored!.terms,
        rare: scored!.rare[i] === 1,
      });
    } else {
      // No keyword: a dated listing is required, or the range means nothing.
      if (!chunk.date) return;
      matches.push({ chunk, score: 0, full: true, rare: true });
    }
  });

  // "trivia night" should mean trivia nights, not every night. When some
  // listings contain every word of the query, only those count; failing
  // that, the ones with its rarest word; any-word matches are the last
  // resort.
  if (scored && scored.terms > 1) {
    const keep = matches.some((m) => m.full) ? "full" : matches.some((m) => m.rare) ? "rare" : null;
    if (keep) {
      for (let i = matches.length - 1; i >= 0; i--) {
        if (!matches[i][keep]) matches.splice(i, 1);
      }
    }
  }

  if (scores && params.minRelevance) {
    const top = matches.reduce((m, x) => Math.max(m, x.score), 0);
    const floor = top * params.minRelevance;
    for (let i = matches.length - 1; i >= 0; i--) {
      if (matches[i].score < floor) matches.splice(i, 1);
    }
  }

  if (scores) {
    matches.sort(
      (a, b) =>
        b.score - a.score ||
        (a.chunk.date ?? "9999").localeCompare(b.chunk.date ?? "9999"),
    );
  } else {
    // Pleasanton first, then the rest of the valley, each in date order, so a
    // busy weekend shows the town's own events before the overflow.
    matches.sort((a, b) => {
      const pa = a.chunk.city === "Pleasanton" ? 0 : 1;
      const pb = b.chunk.city === "Pleasanton" ? 0 : 1;
      return (
        pa - pb ||
        (a.chunk.date ?? "").localeCompare(b.chunk.date ?? "") ||
        (a.chunk.start_at ?? "").localeCompare(b.chunk.start_at ?? "")
      );
    });
  }

  const byDay: Record<string, number> = {};
  let pleasanton = 0;
  for (const m of matches) {
    if (m.chunk.city === "Pleasanton") pleasanton += 1;
    const day = m.chunk.date ?? "undated";
    byDay[day] = (byDay[day] ?? 0) + 1;
  }

  return {
    total: matches.length,
    pleasanton,
    byDay,
    results: matches.slice(0, limit).map((m) => m.chunk),
  };
}
