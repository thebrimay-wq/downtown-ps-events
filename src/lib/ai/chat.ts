import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {
  coverageWindow,
  MAX_RESULTS,
  searchKnowledge,
  type SearchParams,
  type SearchResponse,
} from "../knowledge/search";
import { TRI_VALLEY_CITIES, whenLabel } from "../knowledge/render";
import type { KnowledgeChunk } from "../knowledge/types";
import { localDateKey } from "../utils";

// ---------------------------------------------------------------------------
// The "Ask" assistant. Claude answers questions about local events by calling
// one tool, search_events, which runs over the markdown knowledge base
// (src/lib/knowledge). It never answers from memory: every event it names
// came back from a search in this conversation.
//
// Responses stream as a sequence of ChatEvents so the page can show text as
// it arrives, a status line while a search runs, and event cards at the end.
// ---------------------------------------------------------------------------

export const CHAT_MODEL = process.env.ANTHROPIC_CHAT_MODEL || "claude-opus-5";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];
const EFFORT: Effort = EFFORTS.includes(process.env.ANTHROPIC_CHAT_EFFORT as Effort)
  ? (process.env.ANTHROPIC_CHAT_EFFORT as Effort)
  : "medium";

// Tool rounds per question. Two or three searches cover a weekend; the last
// round is forced to answer so a chatty search loop cannot run away.
const MAX_ROUNDS = 4;
const MAX_TOKENS = 8000;

export { chatEnabled } from "./config";

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

// --- Prompt -----------------------------------------------------------------

// Fixed for every request, so it caches. Anything that changes per request
// (today's date, coverage) goes in the second system block.
const SYSTEM = `You are the assistant for Pleasanton Events Hub, a community calendar for Pleasanton, California and the rest of the Tri-Valley (Livermore, Dublin, San Ramon, Danville, Sunol). People ask you what is going on: this weekend, on a date, at a venue, for kids, for free, and so on.

Your only source of truth is the search_events tool. It searches a knowledge base compiled from event listings crawled from local websites. Call it before answering any question about events, dates, venues, prices, or things to do. Never answer such questions from memory, and never invent an event, date, time, price, or venue. If the search finds nothing, say so plainly.

Searching well:
- Turn relative dates into a from/to range using the date facts below. "This weekend" means the coming Friday through Sunday (or today through Sunday if the weekend has started). "This week" runs through the coming Sunday. A month means its first to last day.
- Use query for topics, artists, venues, and kinds of events ("live music", "wine tasting", "storytime", "Firehouse Arts Center"). For a plain "what's happening" question leave query null and let the dates do the work.
- Use city when the person names one. Otherwise leave it null: results already list Pleasanton first.
- A busy weekend can return more matches than one search shows. Read the counts by day in the result, and search again (one day at a time, or with a keyword) when you need a fuller picture.
- If a search comes back empty, widen the dates or drop the keyword once before concluding nothing is on.

Answering:
- Be warm, direct, and brief. A one-line lead, then the events. Group by day when the question spans several days.
- For each event give the name, day and time, venue or city, and price if known. Link the event name to its link path exactly as the tool gives it, as a markdown link: [Title](/events/some-slug). Do not link to anything else.
- Mention how many matches there were in total when you only list some, and offer to narrow down.
- Prefer Pleasanton events. Bring in nearby Tri-Valley events when they fit the question or Pleasanton is quiet, and say which town they are in.
- Listings come from public websites and can change. When details matter (tickets, times), suggest checking the source before going.
- If the question is not about local events, answer in a sentence and steer back to what you can help with.
- Do not include internal or system XML tags in your response.`;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

// Date facts in Pleasanton's own timezone, written so the model has nothing
// to work out: today, tomorrow, the coming weekend, and the coverage window.
async function contextBlock(): Promise<string> {
  const now = new Date();
  const todayKey = localDateKey(now);
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "America/Los_Angeles",
  }).format(now);
  // Do date arithmetic on the local calendar day, not the UTC instant.
  const [y, m, d] = todayKey.split("-").map(Number);
  const today = new Date(Date.UTC(y, m - 1, d));
  const key = (date: Date) =>
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  const wd = today.getUTCDay(); // 0 = Sunday
  const daysToFriday = wd === 6 || wd === 0 ? 0 : (5 - wd + 7) % 7;
  const weekendStart = wd === 6 || wd === 0 ? today : addDays(today, daysToFriday);
  const weekendEnd = addDays(today, (7 - wd) % 7);
  const window = await coverageWindow();
  return [
    `Today is ${weekday}, ${todayKey} (America/Los_Angeles).`,
    `Tomorrow is ${key(addDays(today, 1))}.`,
    `The coming weekend is ${key(weekendStart)} (Friday) to ${key(weekendEnd)} (Sunday).`,
    `The end of this week is ${key(weekendEnd)}.`,
    window.start && window.end
      ? `The listings cover ${window.start} to ${window.end}. Outside that window there is nothing to find.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// --- Tool -------------------------------------------------------------------

const SEARCH_TOOL: Anthropic.Beta.BetaTool = {
  name: "search_events",
  description:
    "Search the local event listings. Filters by date range, city, and category, and ranks by keyword relevance when a query is given. Returns up to `limit` matching events with their day, time, venue, price, description, and link, plus counts of all matches by day.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: ["string", "null"],
        description:
          "Keywords: a topic, artist, venue, or kind of event. Null for a plain what's-on question.",
      },
      from: {
        type: ["string", "null"],
        description: "First day to include, YYYY-MM-DD (inclusive). Null for no lower bound.",
      },
      to: {
        type: ["string", "null"],
        description: "Last day to include, YYYY-MM-DD (inclusive). Null for no upper bound.",
      },
      city: {
        type: ["string", "null"],
        description: `Only events in this town. One of: ${TRI_VALLEY_CITIES.join(", ")}. Null for the whole Tri-Valley.`,
      },
      category: {
        type: ["string", "null"],
        description:
          "Only this category. One of: music, arts, food-drink, family, market, community, sports, festival, education, nightlife, other. Null for any.",
      },
      limit: {
        type: ["integer", "null"],
        description: `How many events to return, 1 to ${MAX_RESULTS}. Null for the default of 40.`,
      },
    },
    required: ["query", "from", "to", "city", "category", "limit"],
    additionalProperties: false,
  },
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseParams(input: unknown): SearchParams {
  const raw = (input ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof raw[k] === "string" && raw[k] ? String(raw[k]) : null);
  const date = (k: string) => {
    const v = str(k);
    return v && DATE_RE.test(v) ? v : null;
  };
  const limit = typeof raw.limit === "number" && Number.isFinite(raw.limit) ? raw.limit : null;
  return {
    query: str("query"),
    from: date("from"),
    to: date("to"),
    city: str("city"),
    category: str("category"),
    limit,
  };
}

const shortDate = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function dayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return shortDate.format(new Date(Date.UTC(y, m - 1, d)));
}

// What the status line says while a search runs.
export function describeSearch(p: SearchParams): string {
  const parts: string[] = [];
  if (p.query) parts.push(`“${p.query}”`);
  if (p.city) parts.push(`in ${p.city}`);
  if (p.from && p.to && p.from === p.to) parts.push(`on ${dayLabel(p.from)}`);
  else if (p.from && p.to) parts.push(`${dayLabel(p.from)} to ${dayLabel(p.to)}`);
  else if (p.from) parts.push(`from ${dayLabel(p.from)}`);
  else if (p.to) parts.push(`through ${dayLabel(p.to)}`);
  return parts.length ? `Searching listings ${parts.join(" ")}…` : "Searching the listings…";
}

function formatChunk(c: KnowledgeChunk, n: number): string {
  const where = [c.venue, c.address].filter(Boolean).join(", ") || c.city || "location not listed";
  const when = c.start_at ? whenLabel({ start_at: c.start_at, end_at: c.end_at, all_day: c.all_day }) : c.date ?? "date not listed";
  const price = c.is_free ? "free" : c.price ?? "price not listed";
  const flags = [c.category, price, c.is_family_friendly ? "family friendly" : null]
    .filter(Boolean)
    .join(" · ");
  const head =
    c.kind === "event"
      ? `[${n}] ${c.title}\n    when: ${when}\n    where: ${where}\n    ${flags}\n    link: ${c.link}\n    source: ${c.source}${c.url ? ` (${c.url})` : ""}`
      : `[${n}] ${c.title} (crawled page from ${c.source}${c.url ? `, ${c.url}` : ""})${c.date ? `\n    mentions dates: ${c.date}${c.end_date ? ` to ${c.end_date}` : ""}` : ""}`;
  const body = c.text ? `\n    ${c.text.replace(/\s+/g, " ").trim()}` : "";
  return head + body;
}

function formatResults(res: SearchResponse, p: SearchParams): string {
  if (res.total === 0) {
    return "No listings matched. Try a wider date range, a different keyword, or no keyword.";
  }
  const days = Object.entries(res.byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, n]) => `${day}: ${n}`)
    .join(", ");
  const lines = [
    `${res.total} matching listings (${res.pleasanton} in Pleasanton). Showing ${res.results.length}${
      res.total > res.results.length
        ? p.query
          ? ", ranked by relevance."
          : ", Pleasanton first then by date. Search a narrower range for the rest."
        : "."
    }`,
    `Matches by day: ${days}`,
    "",
    ...res.results.map((c, i) => formatChunk(c, i + 1)),
  ];
  return lines.join("\n");
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

// The cards under an answer are the events the answer linked, in the order
// they were mentioned; failing that, the best matches the search returned.
function pickSources(answer: string, seen: Map<string, KnowledgeChunk>): SourceCard[] {
  const mentioned: KnowledgeChunk[] = [];
  for (const m of answer.matchAll(/\]\((\/events\/[^)\s]+)\)/g)) {
    const chunk = [...seen.values()].find((c) => c.link === m[1]);
    if (chunk && !mentioned.includes(chunk)) mentioned.push(chunk);
  }
  const picked = mentioned.length ? mentioned : [...seen.values()].filter((c) => c.kind === "event").slice(0, 6);
  return picked.slice(0, 8).map(toCard);
}

// --- The loop ---------------------------------------------------------------

export async function* runChat(
  turns: ChatTurn[],
  signal?: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((t) => ({
    role: t.role,
    content: t.content,
  }));
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
    { type: "text", text: await contextBlock() },
  ];

  const seen = new Map<string, KnowledgeChunk>();
  let answer = "";

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const lastRound = round === MAX_ROUNDS - 1;
    const stream = client.beta.messages.stream(
      {
        model: CHAT_MODEL,
        max_tokens: MAX_TOKENS,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system,
        tools: [SEARCH_TOOL],
        tool_choice: lastRound ? { type: "none" } : { type: "auto" },
        thinking: { type: "adaptive" },
        output_config: { effort: EFFORT },
        messages,
      },
      { signal },
    );

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        answer += event.delta.text;
        yield { type: "text", text: event.delta.text };
      } else if (
        event.type === "content_block_start" &&
        event.content_block.type === "tool_use"
      ) {
        yield { type: "status", text: "Searching the listings…" };
      }
    }
    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      yield {
        type: "text",
        text: answer
          ? ""
          : "I can't help with that one. Ask me what's going on around Pleasanton and I'll dig in.",
      };
      break;
    }
    if (message.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: message.content });
      continue;
    }
    if (message.stop_reason !== "tool_use") break;

    const uses = message.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
    );
    messages.push({ role: "assistant", content: message.content });

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const use of uses) {
      const params = parseParams(use.input);
      yield { type: "status", text: describeSearch(params) };
      try {
        const res = await searchKnowledge(params);
        for (const c of res.results) seen.set(c.id, c);
        results.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: formatResults(res, params),
        });
      } catch (err) {
        results.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: `Search failed: ${err instanceof Error ? err.message : String(err)}`,
          is_error: true,
        });
      }
    }
    messages.push({ role: "user", content: results });
  }

  yield { type: "sources", events: pickSources(answer, seen) };
  yield { type: "done" };
}

// --- Without an API key -----------------------------------------------------

// Keyword search only, so the page still does something useful before the
// site has a key. Says so up front rather than pretending to be an answer.
export async function* runWithoutAi(question: string): AsyncGenerator<ChatEvent> {
  const res = await searchKnowledge({ query: question, limit: 8 });
  yield {
    type: "text",
    text:
      "AI answers are not switched on for this site yet (no ANTHROPIC_API_KEY is configured), so here is a plain keyword search of the listings instead.\n\n",
  };
  if (res.total === 0) {
    yield { type: "text", text: `Nothing in the listings matched “${question}”. Try a venue, an artist, or a kind of event.` };
  } else {
    const lines = res.results.map(
      (c) =>
        `- [${c.title}](${c.link ?? c.url ?? "#"}) — ${
          c.start_at ? whenLabel({ start_at: c.start_at, end_at: c.end_at, all_day: c.all_day }) : c.date ?? ""
        }${c.venue ? `, ${c.venue}` : c.city ? `, ${c.city}` : ""}`,
    );
    yield {
      type: "text",
      text: `${res.total} listings matched “${question}”. The closest:\n\n${lines.join("\n")}`,
    };
  }
  yield { type: "sources", events: res.results.filter((c) => c.kind === "event").map(toCard) };
  yield { type: "done" };
}
