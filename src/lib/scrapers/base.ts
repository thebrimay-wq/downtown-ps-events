import * as cheerio from "cheerio";
import type { RawScrapedEvent } from "../types";
import type { ScrapeContext } from "./types";

// ---------------------------------------------------------------------------
// Generic extraction utilities shared by all source adapters.
//
// Strategy, in order of reliability:
//   1. schema.org Event JSON-LD  (<script type="application/ld+json">)
//   2. Microdata itemtype="...schema.org/Event"
//   3. Heuristic DOM scan for elements that look like event listings
//
// Adapters layer source-specific hints (default category, container selector)
// on top of these.
// ---------------------------------------------------------------------------

function abs(baseUrl: string, href?: string): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function firstString(v: unknown): string | undefined {
  if (typeof v === "string") return v.trim() || undefined;
  if (Array.isArray(v)) return firstString(v[0]);
  return undefined;
}

// Pull schema.org Event nodes out of any JSON-LD payload, however nested
// (handles @graph, arrays, and single objects).
function collectEventNodes(node: unknown, acc: Record<string, unknown>[]) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const n of node) collectEventNodes(n, acc);
    return;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const type = obj["@type"];
    const typeStr = Array.isArray(type) ? type.join(" ") : String(type ?? "");
    if (/event/i.test(typeStr)) acc.push(obj);
    if (obj["@graph"]) collectEventNodes(obj["@graph"], acc);
    if (obj.itemListElement) collectEventNodes(obj.itemListElement, acc);
    if (obj.item) collectEventNodes(obj.item, acc);
  }
}

function placeToString(loc: unknown): {
  venue?: string;
  address?: string;
} {
  if (!loc) return {};
  if (typeof loc === "string") return { venue: loc };
  if (Array.isArray(loc)) return placeToString(loc[0]);
  const obj = loc as Record<string, unknown>;
  const venue = firstString(obj.name);
  const addr = obj.address;
  let address: string | undefined;
  if (typeof addr === "string") address = addr;
  else if (addr && typeof addr === "object") {
    const a = addr as Record<string, unknown>;
    address = [
      firstString(a.streetAddress),
      firstString(a.addressLocality),
      firstString(a.addressRegion),
      firstString(a.postalCode),
    ]
      .filter(Boolean)
      .join(", ");
  }
  return { venue, address };
}

function offerToPrice(offers: unknown): string | undefined {
  if (!offers) return undefined;
  const o = Array.isArray(offers) ? offers[0] : offers;
  if (typeof o !== "object" || o === null) return undefined;
  const obj = o as Record<string, unknown>;
  const price = obj.price ?? obj.lowPrice;
  if (price === undefined || price === null) return undefined;
  const num = Number(price);
  if (num === 0) return "Free";
  const currency = firstString(obj.priceCurrency) === "USD" ? "$" : "";
  return `${currency}${price}`;
}

export function extractJsonLdEvents(
  html: string,
  baseUrl: string,
): RawScrapedEvent[] {
  const $ = cheerio.load(html);
  const nodes: Record<string, unknown>[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    try {
      collectEventNodes(JSON.parse(raw), nodes);
    } catch {
      // Some sites emit multiple JSON objects or trailing commas; skip those.
    }
  });

  return nodes.map((n) => {
    const { venue, address } = placeToString(n.location);
    const start = firstString(n.startDate);
    const end = firstString(n.endDate);
    return {
      title: firstString(n.name),
      date: start,
      start_time: start,
      end_time: end,
      venue,
      address,
      description: firstString(n.description),
      image_url:
        abs(baseUrl, firstString(n.image)) ?? firstString(n.image),
      source_url: abs(baseUrl, firstString(n.url)) ?? baseUrl,
      price: offerToPrice(n.offers),
    } satisfies RawScrapedEvent;
  });
}

// Microdata fallback: elements tagged with an itemtype of schema.org/Event.
export function extractMicrodataEvents(
  html: string,
  baseUrl: string,
): RawScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: RawScrapedEvent[] = [];
  $('[itemtype*="schema.org/Event"]').each((_, el) => {
    const $el = $(el);
    const prop = (name: string) =>
      $el.find(`[itemprop="${name}"]`).first();
    const title =
      prop("name").text().trim() || $el.find("h1,h2,h3").first().text().trim();
    if (!title) return;
    const start =
      prop("startDate").attr("content") ||
      prop("startDate").attr("datetime") ||
      prop("startDate").text().trim();
    events.push({
      title,
      date: start || undefined,
      start_time: start || undefined,
      venue: prop("location").text().trim() || undefined,
      description: prop("description").text().trim() || undefined,
      image_url: abs(baseUrl, prop("image").attr("src")),
      source_url:
        abs(baseUrl, $el.find("a").first().attr("href")) ?? baseUrl,
    });
  });
  return events;
}

// Heuristic DOM scan: a last resort that looks for repeated list items that
// contain a heading + a date-like string. Conservative by design.
export function extractHeuristicEvents(
  html: string,
  baseUrl: string,
  containerSelector?: string,
): RawScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: RawScrapedEvent[] = [];
  const selector =
    containerSelector ||
    [
      ".event",
      ".event-item",
      ".events-list-item",
      ".eventitem",
      "article.event",
      "li.event",
      "[class*='event-card']",
      "[class*='calendar-event']",
    ].join(",");

  const dateLike =
    /\b(\d{4}-\d{2}-\d{2}|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}|\d{1,2}\/\d{1,2}(\/\d{2,4})?)\b/i;

  $(selector).each((_, el) => {
    const $el = $(el);
    const title =
      $el.find("h1,h2,h3,h4,.title,[class*='title']").first().text().trim() ||
      $el.find("a").first().text().trim();
    if (!title || title.length > 200) return;

    const text = $el.text().replace(/\s+/g, " ").trim();
    const dateMatch = text.match(dateLike);
    const link = $el.find("a").first().attr("href");
    const img = $el.find("img").first().attr("src");

    events.push({
      title,
      date: dateMatch?.[0],
      description: text.slice(0, 500),
      image_url: abs(baseUrl, img),
      source_url: abs(baseUrl, link) ?? baseUrl,
    });
  });

  // De-dupe identical titles produced by overlapping selectors.
  const seen = new Set<string>();
  return events.filter((e) => {
    const key = (e.title ?? "").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Run the full extraction cascade and tag each event with a default category.
export function genericExtract(
  ctx: ScrapeContext,
  opts: { defaultCategory: string; containerSelector?: string },
): RawScrapedEvent[] {
  const { html, baseUrl } = ctx;

  let events = extractJsonLdEvents(html, baseUrl);
  if (events.length === 0) events = extractMicrodataEvents(html, baseUrl);
  if (events.length === 0)
    events = extractHeuristicEvents(html, baseUrl, opts.containerSelector);

  return events
    .filter((e) => e.title)
    .map((e) => ({
      ...e,
      source_url: e.source_url ?? ctx.source.url,
      category: e.category ?? opts.defaultCategory,
    }));
}
