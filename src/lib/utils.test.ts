import test from "node:test";
import assert from "node:assert/strict";
import {
  formatLongDateRange,
  formatTimeRange,
  sortByDayAndTime,
} from "./utils";

test("timed events sort ahead of all-day ones on the same day", () => {
  const sorted = sortByDayAndTime([
    { id: "noon-placeholder", start_at: "2026-10-03T12:00:00-07:00", all_day: true },
    { id: "evening", start_at: "2026-10-03T19:00:00-07:00" },
    { id: "next-day", start_at: "2026-10-04T09:00:00-07:00" },
    { id: "morning", start_at: "2026-10-03T09:00:00-07:00" },
  ]);
  assert.deepEqual(
    sorted.map((e) => e.id),
    ["morning", "evening", "noon-placeholder", "next-day"],
  );
});

test("a late-night event stays on its Pacific day", () => {
  // 11 PM Pacific on the 3rd is 6 AM UTC on the 4th.
  const sorted = sortByDayAndTime([
    { id: "b", start_at: "2026-10-04T08:00:00-07:00" },
    { id: "a", start_at: "2026-10-04T06:00:00Z" },
  ]);
  assert.deepEqual(sorted.map((e) => e.id), ["a", "b"]);
});

test("a multi-day event prints both ends of its range", () => {
  const start = "2026-09-18T10:00:00-07:00";
  const end = "2026-09-20T12:00:00-07:00";
  assert.equal(
    formatLongDateRange(start, end),
    "Friday, September 18 – Sunday, September 20, 2026",
  );
  assert.equal(formatTimeRange(start, end), "Sep 18, 10:00 AM – Sep 20, 12:00 PM");
  assert.equal(formatTimeRange(start, "2026-09-18T12:00:00-07:00"), "10:00 AM – 12:00 PM");
  assert.equal(formatLongDateRange(start, null), "Friday, September 18, 2026");
  assert.equal(formatTimeRange(start, end, true), "Time not listed");
});

test("a range across New Year spells out both years", () => {
  assert.equal(
    formatLongDateRange("2026-12-31T20:00:00-08:00", "2027-01-01T02:00:00-08:00"),
    "Thursday, December 31, 2026 – Friday, January 1, 2027",
  );
});
