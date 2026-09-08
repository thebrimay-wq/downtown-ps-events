import "server-only";
import { coverageWindow, MAX_RESULTS, searchKnowledge, type SearchParams } from "../knowledge/search";
import { whenLabel } from "../knowledge/render";
import type { KnowledgeChunk } from "../knowledge/types";
import { formatTime, localDateKey } from "../utils";
import { dayLabel, parseConversation, toKey, type Intent } from "./intent";

// ---------------------------------------------------------------------------
// The "Ask" assistant, with no model behind it. A question is parsed into
// search filters (intent.ts), the knowledge base is searched, and the reply
// is written from templates: a lead line, the events grouped by day, and a
// closing line when there is more to see. Every event named came from the
// search, so nothing is made up, and nothing costs anything per question.
//
// Responses stream as a sequence of ChatEvents so the page can show a status
// line while the search runs and event cards at the end.
// ---------------------------------------------------------------------------

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

// What the page renders under an answer.
export interface SourceCard {
  id: string;
  title: string;
  link: string | null;
  url: string | null;
  date: string | null;
  when: string | null;
  venue: string | null;
  city: string | null;
  price: string | null;
  is_free: boolean;
  category: string | null;
  source: string;
}

export type ChatEvent =
  | { type: "status"; text: string }
  | { type: "text"; text: string }
  | { type: "sources"; events: SourceCard[] }
  | { type: "done" }
  | { type: "error"; message: string };

// How much of a long list to show before offering to narrow down.
const PER_DAY = 5;
const TOTAL = 14;
const DAYS = 7;
const MORE = { perDay: 12, total: 40, days: 14 };

// [one, many]
const CATEGORY_NOUN: Record<string, [string, string]> = {
  music: ["live music event", "live music events"],
  arts: ["arts & culture event", "arts & culture events"],
  "food-drink": ["food & drink event", "food & drink events"],
  family: ["family event", "family events"],
  market: ["market", "markets"],
  community: ["community event", "community events"],
  sports: ["sports & fitness event", "sports & fitness events"],
  festival: ["festival", "festivals"],
  education: ["class or talk", "classes & talks"],
  nightlife: ["nightlife event", "nightlife events"],
  other: ["listing", "listings"],
};

function categoryNoun(category: string, n: number): string {
  const pair = CATEGORY_NOUN[category] ?? [category, category];
  return n === 1 ? pair[0] : pair[1];
}

// --- Searching ---------------------------------------------------------------

interface Found {
  chunks: KnowledgeChunk[];
  total: number;
  pleasanton: number;
  byDay: Record<string, number>;
  // Set when the first search came back empty and a looser one was used.
  note: string | null;
}

function toParams(i: Intent, today: string): SearchParams {
  return {
    query: i.query,
    from: i.from ?? today,
    to: i.to,
    city: i.city,
    category: i.category,
    free: i.free,
    family: i.family,
    eventsOnly: true,
    minRelevance: 0.35,
    limit: MAX_RESULTS,
  };
}

// Listings the scraper marked family-friendly that say otherwise in the title.
const ADULTS_RE = /\b(adults?[- ]only|21\s*\+|18\s*\+|19\s*\+|over 21)\b/i;

// Events on or after 4 PM, plus all-day ones, when someone asked for tonight.
function eveningOnly(chunks: KnowledgeChunk[]): KnowledgeChunk[] {
  const hour = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: "America/Los_Angeles",
  });
  return chunks.filter(
    (c) => c.all_day || !c.start_at || Number(hour.format(new Date(c.start_at))) >= 16,
  );
}

async function run(params: SearchParams, evening: boolean): Promise<Omit<Found, "note">> {
  const res = await searchKnowledge(params);
  const family = Boolean(params.family);
  if (!evening && !family) {
    return { chunks: res.results, total: res.total, pleasanton: res.pleasanton, byDay: res.byDay };
  }
  let chunks = res.results;
  if (evening) chunks = eveningOnly(chunks);
  if (family) chunks = chunks.filter((c) => !ADULTS_RE.test(c.title));
  const byDay: Record<string, number> = {};
  let pleasanton = 0;
  for (const c of chunks) {
    if (c.city === "Pleasanton") pleasanton += 1;
    byDay[c.date ?? "undated"] = (byDay[c.date ?? "undated"] ?? 0) + 1;
  }
  return { chunks, total: chunks.length, pleasanton, byDay };
}

function addDaysKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return toKey(new Date(Date.UTC(y, m - 1, d + n)));
}

// The first search, then progressively looser ones when it finds nothing:
// drop the category, look further ahead for the keyword, drop the keyword,
// and finally look at the next two weeks with no filters at all.
async function find(i: Intent, today: string): Promise<Found> {
  const base = toParams(i, today);
  const scope = describeScope(i);
  const first = await run(base, i.evening);
  if (first.total > 0) return { ...first, note: null };

  if (i.category) {
    const r = await run({ ...base, category: null }, i.evening);
    if (r.total > 0) {
      return {
        ...r,
        note: `No ${categoryNoun(i.category, 2)} ${scope}, but here is what else is on:`,
      };
    }
  }
  if (i.query && i.to) {
    const from = i.from ?? today;
    const r = await run({ ...base, category: null, from, to: addDaysKey(from, 90) }, false);
    if (r.total > 0) {
      return { ...r, note: `Nothing for “${i.query}” ${scope}. The next ones coming up:` };
    }
  }
  if (i.query) {
    const r = await run({ ...base, query: null, category: null }, i.evening);
    if (r.total > 0) {
      return { ...r, note: `Nothing matched “${i.query}” ${scope}. Here is what is on instead:` };
    }
  }
  if (i.free || i.family) {
    const r = await run({ ...base, query: null, category: null, free: false, family: false }, i.evening);
    if (r.total > 0) {
      return { ...r, note: `Nothing ${i.free ? "free" : "for kids"} ${scope} that I can see. Everything else on:` };
    }
  }
  if (i.to) {
    const from = i.to > today ? i.to : today;
    const r = await run({ query: null, from, to: addDaysKey(from, 14), city: i.city, eventsOnly: true, limit: MAX_RESULTS }, false);
    if (r.total > 0) {
      return { ...r, note: `Nothing on the calendar ${scope}${i.city ? "" : " anywhere in the Tri-Valley"}. The next couple of weeks:` };
    }
  }
  return { ...first, note: null };
}

// "this weekend in Livermore", "tonight", "in October"
function describeScope(i: Intent): string {
  return [i.when ?? "coming up", i.city ? `in ${i.city}` : ""].filter(Boolean).join(" ");
}

// --- Writing ------------------------------------------------------------------

// Some sources put a note where the venue should be. Those are dropped.
const NOT_A_VENUE = /contact us|call for details|@|\bTBA\b|\bTBD\b|to be announced/i;

function cleanVenue(venue: string): string | null {
  if (NOT_A_VENUE.test(venue)) return null;
  const v = venue
    .replace(/\s*\([^)]*\)/g, "")
    .split(">")
    .pop()!
    .replace(/\s+/g, " ")
    .trim();
  if (!v) return null;
  return v.length > 48 ? `${v.slice(0, 45).trimEnd()}…` : v;
}

// Prices arrive as whatever the source page said. Placeholders are dropped
// and bare numbers get a dollar sign.
function cleanPrice(price: string | null): string | null {
  if (!price) return null;
  const p = price.trim();
  if (!p || p.length > 24 || /^(none|null|n\/a|tba|tbd|varies|see (website|site))$/i.test(p)) return null;
  if (/^\d+(\.\d{1,2})?$/.test(p)) return `$${p.replace(/\.0$/, "")}`;
  return p;
}

function bullet(c: KnowledgeChunk, showTown: boolean): string {
  const parts: string[] = [];
  if (c.start_at && !c.all_day) parts.push(formatTime(c.start_at));
  const town = showTown && c.city && c.city !== "Pleasanton" ? c.city : null;
  const venue = c.venue ? cleanVenue(c.venue) : null;
  if (venue) {
    parts.push(town && !venue.toLowerCase().includes(town.toLowerCase()) ? `${venue}, ${town}` : venue);
  } else if (town) {
    parts.push(town);
  }
  const price = c.is_free ? "free" : cleanPrice(c.price);
  if (price) parts.push(price);
  const title = c.title.replace(/\s+/g, " ").trim();
  const name = c.link ? `[${title}](${c.link})` : c.url ? `[${title}](${c.url})` : title;
  return `- ${name}${parts.length ? `, ${parts.join(", ")}` : ""}`;
}

// Which of the matches to show: up to a few per day, across the first few
// days. Keyword searches come back ranked, so the top matches are taken
// first and then put back into date order.
function choose(chunks: KnowledgeChunk[], i: Intent): KnowledgeChunk[] {
  const cap = i.more ? MORE : { perDay: PER_DAY, total: TOTAL, days: DAYS };
  const pool = i.query ? chunks.slice(0, cap.total) : chunks;
  const byDay = new Map<string, KnowledgeChunk[]>();
  for (const c of pool) {
    const day = c.date ?? "undated";
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(c);
  }
  // A keyword search is already trimmed to its best matches; show them all.
  const days = [...byDay.keys()].sort().slice(0, i.query ? undefined : cap.days);
  const out: KnowledgeChunk[] = [];
  for (const day of days) {
    const items = byDay
      .get(day)!
      .sort((a, b) => (a.start_at ?? "").localeCompare(b.start_at ?? ""))
      .slice(0, cap.perDay);
    for (const c of items) {
      if (out.length >= cap.total) break;
      out.push(c);
    }
  }
  return out;
}

// "Saturday, September 12", with the year once it is a different one.
function label(day: string, today: string): string {
  return day.slice(0, 4) === today.slice(0, 4) ? dayLabel(day) : `${dayLabel(day)}, ${day.slice(0, 4)}`;
}

function heading(day: string, today: string): string {
  if (day === "undated") return "Date to be announced";
  if (day === today) return `Today, ${dayLabel(day)}`;
  if (day === addDaysKey(today, 1)) return `Tomorrow, ${dayLabel(day)}`;
  return label(day, today);
}

function countWord(n: number): string {
  return n === 1 ? "One" : String(n);
}

function whatPhrase(i: Intent, n: number): string {
  if (i.query) return n === 1 ? `match for “${i.query}”` : `matches for “${i.query}”`;
  const bits: string[] = [];
  if (i.free) bits.push("free");
  if (i.family && i.category !== "family") bits.push("family-friendly");
  if (i.category) bits.push(categoryNoun(i.category, n));
  else bits.push(n === 1 ? "event" : "events");
  return bits.join(" ");
}

function wherePhrase(i: Intent, f: Found): string {
  if (i.city) return `in ${i.city}`;
  if (f.pleasanton === f.total) return "in Pleasanton";
  if (f.pleasanton === 0) return "around the Tri-Valley";
  return `across the Tri-Valley, ${f.pleasanton} in Pleasanton`;
}

function lead(i: Intent, f: Found, shown: number): string {
  const when = i.when ?? "coming up";
  const line = `${countWord(f.total)} ${whatPhrase(i, f.total)} ${when} ${wherePhrase(i, f)}.`;
  if (shown >= f.total) return line.replace(/\.$/, ":");
  const next = i.query ? "The closest matches, in date order:" : "The first few, leaning Pleasanton:";
  return `${line} ${next}`;
}

// The /events page takes the same filters, so the closing line can hand off
// to it with the person's question already applied.
function calendarPath(i: Intent): string {
  const q = new URLSearchParams();
  if (i.category) q.set("category", i.category);
  if (i.query) q.set("search", i.query);
  if (i.city) q.set("location", i.city);
  if (i.free) q.set("free", "1");
  if (i.family) q.set("family", "1");
  if (i.when === "today" || i.when === "tonight") q.set("date", "today");
  else if (i.when === "this weekend") q.set("date", "weekend");
  else if (i.when === "this week") q.set("date", "week");
  const s = q.toString();
  return s ? `/events?${s}` : "/events";
}

function closing(i: Intent, f: Found, shown: KnowledgeChunk[], today: string): string | null {
  if (shown.length >= f.total) return null;
  const days = Object.keys(f.byDay).filter((d) => d !== "undated").sort();
  const lastShown = shown.map((c) => c.date ?? "").sort().pop() ?? "";
  const lastDay = days[days.length - 1];
  const later = lastDay && lastDay > lastShown ? ` The rest run through ${label(lastDay, today)}.` : "";
  const narrow = i.city && i.query ? "Try another day" : i.city ? "Ask about one day or a kind of event" : "Ask about one day, a town, or a kind of event";
  return `That's ${shown.length} of ${f.total}.${later} ${narrow} to narrow it down, say “more” for a longer list, or browse the [full calendar](${calendarPath(i)}).`;
}

function toCard(c: KnowledgeChunk): SourceCard {
  return {
    id: c.id,
    title: c.title,
    link: c.link,
    url: c.url,
    date: c.date,
    when: c.start_at
      ? whenLabel({ start_at: c.start_at, end_at: c.end_at, all_day: c.all_day })
      : null,
    venue: c.venue,
    city: c.city,
    price: c.price,
    is_free: c.is_free,
    category: c.category,
    source: c.source,
  };
}

function statusLine(i: Intent): string {
  const parts: string[] = [];
  if (i.query) parts.push(`“${i.query}”`);
  else if (i.category) parts.push(categoryNoun(i.category, 2));
  if (i.when) parts.push(i.when);
  if (i.city) parts.push(`in ${i.city}`);
  return parts.length ? `Checking ${parts.join(" ")}…` : "Checking the calendar…";
}

const HELP =
  "I know the local calendar and nothing else. Ask about a day (“tonight”, “Saturday”, “October 3”), a stretch (“this weekend”, “next week”, “in October”), a town, a venue, or a kind of event (“live music”, “free”, “for kids”). Follow-ups work too: “what about Sunday?”, “anything free?”, “more”.";

export async function* runChat(turns: ChatTurn[]): AsyncGenerator<ChatEvent> {
  const today = localDateKey();
  const questions = turns.filter((t) => t.role === "user").map((t) => t.content);
  const intent = parseConversation(questions, today);

  if (intent.kind === "greeting") {
    yield { type: "text", text: "Hi. Ask me what's going on around Pleasanton: a day, a weekend, a town, a venue, or a kind of event." };
    yield { type: "done" };
    return;
  }
  if (intent.kind === "thanks") {
    yield { type: "text", text: "Any time. Ask again whenever you're planning something." };
    yield { type: "done" };
    return;
  }
  if (intent.kind === "help") {
    yield { type: "text", text: HELP };
    yield { type: "done" };
    return;
  }

  yield { type: "status", text: statusLine(intent) };
  const found = await find(intent, today);

  if (found.total === 0) {
    const window = await coverageWindow();
    const scope = describeScope(intent);
    const reach =
      window.end && intent.from && intent.from > window.end
        ? ` The listings only run through ${label(window.end, today)} so far.`
        : "";
    yield {
      type: "text",
      text: intent.query
        ? `Nothing in the listings matches “${intent.query}” ${scope}.${reach} Try a venue, an artist, or a kind of event, or ask about a day instead.`
        : `Nothing on the calendar ${scope}.${reach} Try another day or a wider stretch, like “this month”.`,
    };
    yield { type: "done" };
    return;
  }

  const shown = choose(found.chunks, intent);
  const lines: string[] = [found.note ?? lead(intent, found, shown.length)];
  const multiDay = new Set(shown.map((c) => c.date ?? "undated")).size > 1;
  let currentDay: string | null = null;
  for (const c of shown) {
    const day = c.date ?? "undated";
    if (multiDay && day !== currentDay) {
      lines.push("", `**${heading(day, today)}**`);
      currentDay = day;
    }
    lines.push(bullet(c, !intent.city));
  }
  const tail = found.note ? null : closing(intent, found, shown, today);
  if (tail) lines.push("", tail);

  yield { type: "text", text: lines.join("\n") };
  yield { type: "sources", events: shown.slice(0, 8).map(toCard) };
  yield { type: "done" };
}
