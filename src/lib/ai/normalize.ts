import Anthropic from "@anthropic-ai/sdk";
import type { NormalizedEvent, RawScrapedEvent } from "../types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

const ALLOWED_CATEGORIES = [
  "music",
  "arts",
  "food-drink",
  "family",
  "market",
  "community",
  "sports",
  "festival",
  "education",
  "nightlife",
  "other",
];

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// JSON schema constraining the model's output to a clean event array.
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: ["string", "null"] },
          start_at: { type: "string", description: "ISO 8601 with PT offset" },
          end_at: { type: ["string", "null"] },
          venue: { type: ["string", "null"] },
          address: { type: ["string", "null"] },
          category: { type: "string", enum: ALLOWED_CATEGORIES },
          tags: { type: "array", items: { type: "string" } },
          price: { type: ["string", "null"] },
          is_free: { type: "boolean" },
          is_family_friendly: { type: "boolean" },
          image_url: { type: ["string", "null"] },
          ticket_url: { type: ["string", "null"] },
          source_url: { type: ["string", "null"] },
        },
        required: [
          "title",
          "description",
          "start_at",
          "end_at",
          "venue",
          "address",
          "category",
          "tags",
          "price",
          "is_free",
          "is_family_friendly",
          "image_url",
          "ticket_url",
          "source_url",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["events"],
  additionalProperties: false,
} as const;

function systemPrompt(referenceDate: string): string {
  return `You normalize messy scraped event data for a Pleasanton, California community calendar into clean, structured JSON.

Today's date (America/Los_Angeles) is ${referenceDate}. Resolve any relative or partial dates against it, and assume events are in the Pacific timezone (use the -07:00 or -08:00 offset appropriately).

Rules:
- Output one normalized event per input that has a resolvable date. DROP any input whose date cannot be determined.
- start_at and end_at must be full ISO 8601 timestamps with a Pacific offset. If only a date is known, use a sensible default start time and set end_at to null.
- Clean titles (strip site boilerplate, fix capitalization) and trim descriptions to plain text under ~600 characters.
- Choose the single best category from: ${ALLOWED_CATEGORIES.join(", ")}.
- is_free: true when the event is free to attend. price: a short human string like "Free", "$10", or "$5–$20", or null if unknown.
- is_family_friendly: true for events clearly suitable for children/families.
- tags: 2–5 short lowercase keywords.
- Preserve image_url, ticket_url, and source_url when present; otherwise null.
- Never invent events. Only normalize what is provided.`;
}

interface AiEvent {
  title: string;
  description: string | null;
  start_at: string;
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

function toNormalized(e: AiEvent): NormalizedEvent | null {
  const start = new Date(e.start_at);
  if (isNaN(start.getTime())) return null;
  return {
    title: e.title.trim(),
    description: e.description?.trim() || null,
    start_at: start.toISOString(),
    end_at:
      e.end_at && !isNaN(new Date(e.end_at).getTime())
        ? new Date(e.end_at).toISOString()
        : null,
    venue: e.venue || null,
    address: e.address || null,
    category: ALLOWED_CATEGORIES.includes(e.category) ? e.category : "other",
    tags: Array.isArray(e.tags) ? e.tags.slice(0, 6) : [],
    price: e.price || null,
    is_free: Boolean(e.is_free),
    is_family_friendly: Boolean(e.is_family_friendly),
    image_url: e.image_url || null,
    ticket_url: e.ticket_url || null,
    source_url: e.source_url || null,
  };
}

// AI-powered normalization via Claude with constrained JSON output.
export async function aiNormalize(
  raw: RawScrapedEvent[],
  referenceDate: string,
): Promise<NormalizedEvent[]> {
  if (raw.length === 0) return [];
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: systemPrompt(referenceDate),
    output_config: {
      format: { type: "json_schema", schema: OUTPUT_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: `Normalize these ${raw.length} scraped events into the structured schema:\n\n${JSON.stringify(
          raw,
          null,
          2,
        )}`,
      },
    ],
  } as Anthropic.MessageCreateParamsNonStreaming);

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return [];

  try {
    const parsed = JSON.parse(text.text) as { events: AiEvent[] };
    return (parsed.events ?? [])
      .map(toNormalized)
      .filter((e): e is NormalizedEvent => e !== null);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Heuristic fallback used when no Anthropic API key is configured. Best-effort
// date parsing + simple price/family inference so the pipeline still works.
// ---------------------------------------------------------------------------
export function heuristicNormalize(
  raw: RawScrapedEvent[],
): NormalizedEvent[] {
  const out: NormalizedEvent[] = [];
  for (const e of raw) {
    if (!e.title) continue;
    const dateStr = e.start_time || e.date;
    if (!dateStr) continue;
    const start = new Date(dateStr);
    if (isNaN(start.getTime())) continue;

    const priceText = (e.price ?? "").toString();
    const isFree =
      /free|no charge|complimentary/i.test(priceText) ||
      /free/i.test(e.description ?? "");
    const family =
      typeof e.is_family_friendly === "boolean"
        ? e.is_family_friendly
        : /kid|child|family|all ages|toddler|storytime/i.test(
            `${e.title} ${e.description ?? ""}`,
          );

    out.push({
      title: e.title.trim(),
      description: e.description?.trim().slice(0, 600) || null,
      start_at: start.toISOString(),
      end_at:
        e.end_time && !isNaN(new Date(e.end_time).getTime())
          ? new Date(e.end_time).toISOString()
          : null,
      venue: e.venue || null,
      address: e.address || null,
      category: e.category || "other",
      tags: [],
      price: priceText || (isFree ? "Free" : null),
      is_free: isFree,
      is_family_friendly: family,
      image_url: e.image_url || null,
      ticket_url: null,
      source_url: e.source_url || null,
    });
  }
  return out;
}

export async function normalizeEvents(
  raw: RawScrapedEvent[],
  referenceDate: string,
): Promise<NormalizedEvent[]> {
  if (aiEnabled()) {
    try {
      const result = await aiNormalize(raw, referenceDate);
      if (result.length > 0) return result;
    } catch (err) {
      console.error("AI normalization failed, falling back to heuristic:", err);
    }
  }
  return heuristicNormalize(raw);
}
