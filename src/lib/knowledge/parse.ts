import type { KnowledgeChunk } from "./types";

// ---------------------------------------------------------------------------
// Reads a markdown file from knowledge/ back into chunks. Pure string work, so
// the build script and any test can call it without touching the filesystem.
// ---------------------------------------------------------------------------

export interface ParsedDocument {
  frontmatter: Record<string, string>;
  body: string;
}

// `---\nkey: value\n---` at the top of the file. Values are plain strings.
export function splitFrontmatter(content: string): ParsedDocument {
  const text = content.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { frontmatter: {}, body: text };
  const frontmatter: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (kv) frontmatter[kv[1]] = kv[2].trim();
  }
  return { frontmatter, body: text.slice(m[0].length) };
}

export function parseMarkdownDocument(
  doc: string,
  content: string,
): KnowledgeChunk[] {
  const { frontmatter, body } = splitFrontmatter(content);
  if (frontmatter.kind === "events") return parseEventDigest(doc, frontmatter, body);
  return parsePage(doc, frontmatter, body);
}

// --- Event digests ----------------------------------------------------------

function parseEventDigest(
  doc: string,
  fm: Record<string, string>,
  body: string,
): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  const sections = body.split(/\n(?=## )/);
  for (const section of sections) {
    const lines = section.split("\n");
    const heading = lines[0]?.match(/^## (.+)$/);
    if (!heading) continue;
    const fields: Record<string, string> = {};
    const bodyLines: string[] = [];
    let inFields = true;
    for (const line of lines.slice(1)) {
      const kv = inFields ? line.match(/^- ([a-z_]+): ?(.*)$/) : null;
      if (kv) fields[kv[1]] = kv[2].trim();
      else if (inFields && line.trim() === "") continue;
      else {
        inFields = false;
        bodyLines.push(line);
      }
    }
    const text = bodyLines.join("\n").trim();
    const opt = (k: string) => (fields[k] ? fields[k] : null);
    const yes = (k: string) => fields[k] === "yes";
    const id = opt("id");
    if (!id) continue;
    chunks.push({
      id,
      kind: "event",
      doc,
      source: opt("source") ?? fm.source ?? "Unknown source",
      url: opt("url"),
      title: heading[1].trim(),
      date: opt("date"),
      end_date: null,
      start_at: opt("start"),
      end_at: opt("end"),
      all_day: yes("all_day"),
      venue: opt("venue"),
      address: opt("address"),
      city: opt("city"),
      category: opt("category"),
      price: opt("price"),
      is_free: yes("free"),
      is_family_friendly: yes("family_friendly"),
      link: fields.slug ? `/events/${fields.slug}` : `/events/${id}`,
      text: text === "(no description)" ? "" : text,
    });
  }
  return chunks;
}

// --- Raw crawled pages ------------------------------------------------------

// Target size of a page slice, in characters. Big enough to hold a whole
// listing entry, small enough that a handful fit in a tool result.
const SLICE = 1400;

const MONTHS = [
  "january", "february", "march", "april", "may", "june", "july",
  "august", "september", "october", "november", "december",
];
const MONTH_RE =
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/gi;
const ISO_RE = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const US_RE = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Every calendar date a piece of text mentions. A month-and-day with no year
// is assumed to be the next occurrence on or after the crawl date.
export function datesIn(text: string, crawled: string | null): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(ISO_RE)) {
    out.add(`${m[1]}-${m[2]}-${m[3]}`);
  }
  for (const m of text.matchAll(US_RE)) {
    out.add(`${m[3]}-${pad(Number(m[1]))}-${pad(Number(m[2]))}`);
  }
  const base = crawled && /^\d{4}-\d{2}-\d{2}/.test(crawled) ? crawled.slice(0, 10) : null;
  for (const m of text.matchAll(MONTH_RE)) {
    const month = MONTHS.findIndex((name) => name.startsWith(m[1].toLowerCase().slice(0, 3))) + 1;
    const day = Number(m[2]);
    if (!month || day < 1 || day > 31) continue;
    let year = m[3] ? Number(m[3]) : null;
    if (!year) {
      if (!base) continue;
      year = Number(base.slice(0, 4));
      if (`${year}-${pad(month)}-${pad(day)}` < base) year += 1;
    }
    out.add(`${year}-${pad(month)}-${pad(day)}`);
  }
  return [...out].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
}

// Crawled markdown is mostly link soup. Keep the words, drop the plumbing.
export function cleanMarkdown(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → their text
    .replace(/<[^>]+>/g, "") // stray html
    .replace(/^\s*[-*_]{3,}\s*$/gm, "") // rules
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parsePage(
  doc: string,
  fm: Record<string, string>,
  body: string,
): KnowledgeChunk[] {
  const clean = cleanMarkdown(body);
  const title =
    fm.title || clean.match(/^#\s+(.+)$/m)?.[1]?.trim() || doc.replace(/\.md$/, "");
  const source = fm.source || "Crawled page";
  const url = fm.url || null;
  const crawled = fm.crawled || fm.fetched || null;

  // Slice on paragraph boundaries so an entry is not cut mid-sentence.
  const slices: string[] = [];
  let current = "";
  for (const para of clean.split(/\n\s*\n/)) {
    const p = para.trim();
    if (!p) continue;
    if (current && current.length + p.length + 2 > SLICE) {
      slices.push(current);
      current = p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
    // A single enormous paragraph still has to be split.
    while (current.length > SLICE * 1.5) {
      slices.push(current.slice(0, SLICE));
      current = current.slice(SLICE);
    }
  }
  if (current) slices.push(current);

  return slices
    .filter((text) => text.replace(/\W/g, "").length > 40)
    .map((text, i) => {
      const dates = datesIn(text, crawled);
      return {
        id: `${doc}#${i + 1}`,
        kind: "page" as const,
        doc,
        source,
        url,
        title: slices.length > 1 ? `${title} (part ${i + 1})` : title,
        date: dates[0] ?? null,
        end_date: dates.length > 1 ? dates[dates.length - 1] : null,
        start_at: null,
        end_at: null,
        all_day: false,
        venue: null,
        address: null,
        city: cityIn(text),
        category: null,
        price: null,
        is_free: false,
        is_family_friendly: false,
        link: null,
        text,
      };
    });
}

function cityIn(text: string): string | null {
  const lower = text.toLowerCase();
  for (const city of ["Pleasanton", "Livermore", "Dublin", "San Ramon", "Danville", "Sunol"]) {
    if (lower.includes(city.toLowerCase())) return city;
  }
  return null;
}
