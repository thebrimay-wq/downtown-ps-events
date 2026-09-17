import test from "node:test";
import assert from "node:assert/strict";
import { parseConversation, parseQuestion } from "./intent";

// A Tuesday. The coming weekend is Fri 11 to Sun 13.
const TODAY = "2026-09-08";

function range(text: string, today = TODAY) {
  const i = parseQuestion(text, today);
  return [i.from, i.to];
}

test("relative days", () => {
  assert.deepEqual(range("what's happening tonight?"), ["2026-09-08", "2026-09-08"]);
  assert.equal(parseQuestion("what's happening tonight?", TODAY).evening, true);
  assert.deepEqual(range("anything tomorrow"), ["2026-09-09", "2026-09-09"]);
  assert.deepEqual(range("What's happening this weekend?"), ["2026-09-11", "2026-09-13"]);
  assert.deepEqual(range("next weekend"), ["2026-09-18", "2026-09-20"]);
  assert.deepEqual(range("this week"), ["2026-09-08", "2026-09-13"]);
  assert.deepEqual(range("next week"), ["2026-09-14", "2026-09-20"]);
  assert.deepEqual(range("this month"), ["2026-09-08", "2026-09-30"]);
  assert.deepEqual(range("next month"), ["2026-10-01", "2026-10-31"]);
  assert.deepEqual(range("over the next two weeks"), ["2026-09-08", "2026-09-21"]);
});

test("weekend when it is already Saturday", () => {
  assert.deepEqual(range("this weekend", "2026-09-12"), ["2026-09-12", "2026-09-13"]);
  assert.deepEqual(range("next weekend", "2026-09-12"), ["2026-09-18", "2026-09-20"]);
});

test("weekday names", () => {
  assert.deepEqual(range("what's on Saturday?"), ["2026-09-12", "2026-09-12"]);
  assert.deepEqual(range("friday night"), ["2026-09-11", "2026-09-11"]);
  assert.equal(parseQuestion("friday night", TODAY).evening, true);
  assert.deepEqual(range("this tuesday"), ["2026-09-08", "2026-09-08"]);
  assert.deepEqual(range("next tuesday"), ["2026-09-15", "2026-09-15"]);
  assert.deepEqual(range("next saturday"), ["2026-09-19", "2026-09-19"]);
});

test("months and dates", () => {
  assert.deepEqual(range("Live music in Pleasanton in October"), ["2026-10-01", "2026-10-31"]);
  assert.deepEqual(range("wine events in september"), ["2026-09-08", "2026-09-30"]);
  assert.deepEqual(range("anything in august"), ["2027-08-01", "2027-08-31"]);
  assert.deepEqual(range("in may"), ["2027-05-01", "2027-05-31"]);
  assert.deepEqual(range("october 3rd"), ["2026-10-03", "2026-10-03"]);
  assert.deepEqual(range("oct 3-5"), ["2026-10-03", "2026-10-05"]);
  assert.deepEqual(range("the 3rd of october"), ["2026-10-03", "2026-10-03"]);
  assert.deepEqual(range("on 10/3"), ["2026-10-03", "2026-10-03"]);
  assert.deepEqual(range("what's on in march 2028"), ["2028-03-01", "2028-03-31"]);
  assert.equal(parseQuestion("what's on in march 2028", TODAY).query, null);
  assert.deepEqual(range("in 2027"), ["2027-01-01", "2027-12-31"]);
  assert.deepEqual(range("halloween"), ["2026-10-31", "2026-10-31"]);
  assert.deepEqual(range("thanksgiving"), ["2026-11-26", "2026-11-26"]);
  assert.deepEqual(range("labor day"), ["2027-09-06", "2027-09-06"]);
});

test("no date means upcoming", () => {
  const i = parseQuestion("What's on at the Firehouse Arts Center?", TODAY);
  assert.deepEqual([i.from, i.to, i.when], [null, null, null]);
  assert.equal(i.query, "firehouse arts center");
  assert.equal(i.category, null);
});

test("towns, kinds, free, kids", () => {
  const a = parseQuestion("Anything free for kids this week?", TODAY);
  assert.equal(a.free, true);
  assert.equal(a.family, true);
  assert.equal(a.query, null);

  const b = parseQuestion("Wine events in Livermore this month", TODAY);
  assert.equal(b.city, "Livermore");
  assert.equal(b.query, "wine");
  assert.equal(b.category, null);

  const c = parseQuestion("Live music in Pleasanton in October", TODAY);
  assert.equal(c.city, "Pleasanton");
  assert.equal(c.category, "music");
  assert.equal(c.query, null);

  const d = parseQuestion("farmers market", TODAY);
  assert.equal(d.category, "market");
  assert.equal(d.query, null);

  const e = parseQuestion("Is there a jazz concert in San Ramon on Saturday?", TODAY);
  assert.equal(e.city, "San Ramon");
  assert.equal(e.category, "music");
  assert.equal(e.query, "jazz");
  assert.deepEqual([e.from, e.to], ["2026-09-12", "2026-09-12"]);
});

test("filler is dropped from the keyword query", () => {
  assert.equal(parseQuestion("What's happening this weekend?", TODAY).query, null);
  assert.equal(parseQuestion("Is there anything going on tonight?", TODAY).query, null);
  assert.equal(parseQuestion("things to do with the family near me", TODAY).query, null);
  assert.equal(parseQuestion("can you recommend something fun", TODAY).query, null);
  assert.equal(parseQuestion("Bankhead Theater", TODAY).query, "bankhead theater");
  assert.equal(parseQuestion("trivia night", TODAY).query, "trivia night");
});

test("small talk", () => {
  assert.equal(parseQuestion("hi there!", TODAY).kind, "greeting");
  assert.equal(parseQuestion("thanks so much", TODAY).kind, "thanks");
  assert.equal(parseQuestion("what can you do?", TODAY).kind, "help");
});

test("follow-ups carry the earlier filters", () => {
  const a = parseConversation(["Live music this weekend", "what about Sunday?"], TODAY);
  assert.equal(a.category, "music");
  assert.deepEqual([a.from, a.to], ["2026-09-13", "2026-09-13"]);

  const b = parseConversation(["kids stuff this weekend in Livermore", "anything free?"], TODAY);
  assert.equal(b.family, true);
  assert.equal(b.free, true);
  assert.equal(b.city, "Livermore");
  assert.deepEqual([b.from, b.to], ["2026-09-11", "2026-09-13"]);

  const c = parseConversation(["Live music this weekend", "more"], TODAY);
  assert.equal(c.more, true);
  assert.equal(c.category, "music");

  const d = parseConversation(["Live music this weekend", "and in Pleasanton only"], TODAY);
  assert.equal(d.city, "Pleasanton");
  assert.equal(d.category, "music");
});

test("a fresh question does not inherit", () => {
  const i = parseConversation(["kids stuff this weekend", "Wine events in Livermore this month"], TODAY);
  assert.equal(i.family, false);
  assert.equal(i.city, "Livermore");
  assert.equal(i.query, "wine");
});
