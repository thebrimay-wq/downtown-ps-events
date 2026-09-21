import test from "node:test";
import assert from "node:assert/strict";
import { buildCorpus, searchCorpus } from "./engine";
import type { KnowledgeChunk } from "./types";

function chunk(id: string, title: string, text = "", city = "Pleasanton"): KnowledgeChunk {
  return {
    id,
    kind: "event",
    doc: "test.md",
    source: "Test",
    url: null,
    title,
    date: "2026-10-03",
    end_date: null,
    start_at: "2026-10-03T19:00:00-07:00",
    end_at: null,
    all_day: false,
    venue: null,
    address: null,
    city,
    category: null,
    price: null,
    is_free: false,
    is_family_friendly: false,
    link: null,
    text,
  };
}

const corpus = buildCorpus([
  chunk("a", "Pleasanton Farmers' Market", "Every Saturday on Main Street."),
  chunk("b", "Danville Flea Market", "Antiques and collectibles.", "Danville"),
  chunk("c", "Spooktacular Broadway Revue", "A family rally of show tunes.", "Danville"),
  chunk("d", "Knitting & Crochet Circle", "Bring a project."),
  chunk("e", "Food Truck Friday", "Six trucks on the plaza."),
  chunk("f", "Taco Truck Tuesday", "One truck, long line."),
]);

// The tier is what lets the chat tell a match from a coincidence: the
// listings contained the whole phrase, only its rarest word, or any one word.
test("every word present is a full match", () => {
  const r = searchCorpus(corpus, { query: "farmers market" });
  assert.equal(r.tier, "full");
  assert.deepEqual(r.results.map((c) => c.id), ["a"]);
});

test("a single-word query is always a full match", () => {
  const r = searchCorpus(corpus, { query: "knitting" });
  assert.equal(r.tier, "full");
  assert.deepEqual(r.results.map((c) => c.id), ["d"]);
});

test("only the rarest word present is a rare match, and drops the rest", () => {
  // "market" is in two listings, "flea" in one: the flea listing wins alone.
  const r = searchCorpus(corpus, { query: "flea market pleasanton" });
  assert.equal(r.tier, "rare");
  assert.deepEqual(r.results.map((c) => c.id), ["b"]);
});

test("a hit on only the rarest word is rare, however absurd the pairing", () => {
  // What happened in production: no listing mentions monster trucks, one
  // mentions a rally, so the revue came back for a monster truck question.
  // The tier is what lets the chat label it as the nearest thing rather
  // than announce "one match".
  const r = searchCorpus(corpus, { query: "monster truck rally" });
  assert.equal(r.tier, "rare");
  assert.deepEqual(r.results.map((c) => c.id), ["c"]);
});

test("when the rarest word's listings are filtered out, what is left is an any-word hit", () => {
  // "rally" is rarer than "truck" but its only listing is in Danville;
  // asking in Pleasanton leaves two truck listings that share one word.
  const r = searchCorpus(corpus, { query: "truck rally", city: "Pleasanton" });
  assert.equal(r.tier, "any");
  assert.deepEqual(new Set(r.results.map((c) => c.id)), new Set(["e", "f"]));
});

test("nothing in common is no tier at all", () => {
  const r = searchCorpus(corpus, { query: "quidditch tournament" });
  assert.equal(r.total, 0);
  assert.equal(r.tier, null);
});

test("no query means no tier", () => {
  const r = searchCorpus(corpus, { from: "2026-10-01", to: "2026-10-31" });
  assert.equal(r.tier, null);
  assert.equal(r.total, 6);
});

test("\"here\" and \"nearby\" are not words to search for", () => {
  // Every listing is "here", so the word carries nothing; before it was a
  // stop word, "knitting here" was a rare-tier hit on knitting alone.
  const r = searchCorpus(corpus, { query: "knitting here" });
  assert.equal(r.tier, "full");
  assert.deepEqual(r.results.map((c) => c.id), ["d"]);
  const n = searchCorpus(corpus, { query: "taco truck nearby" });
  assert.equal(n.tier, "full");
  assert.deepEqual(n.results.map((c) => c.id), ["f"]);
});

test("only the first dozen distinct words are searched", () => {
  // The CPU cap: a term past the twelfth is ignored, even when it is the one
  // that would have matched.
  const filler = "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima";
  assert.equal(searchCorpus(corpus, { query: `${filler} knitting` }).tier, null);
  assert.equal(searchCorpus(corpus, { query: `knitting ${filler}` }).tier, "rare");
});
