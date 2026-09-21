import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TZ = "America/Los_Angeles";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: TZ,
});

const longDateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: TZ,
});

const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: TZ,
});

export function formatEventDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function formatLongDate(iso: string): string {
  return longDateFmt.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}


// Month + day split out for the ticket-stub date block on cards.
const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: TZ });
const dayFmt = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: TZ });

export function formatMonthShort(iso: string): string {
  return monthFmt.format(new Date(iso));
}

export function formatDayNumber(iso: string): string {
  return dayFmt.format(new Date(iso));
}

// True when the end falls on a later Pleasanton calendar day than the start.
export function spansDays(startIso: string, endIso?: string | null): boolean {
  return (
    !!endIso && localDateKey(new Date(endIso)) !== localDateKey(new Date(startIso))
  );
}

export function formatTimeRange(
  startIso: string,
  endIso?: string | null,
  allDay?: boolean,
): string {
  // Many list pages publish a date with no time (Eventbrite and AllEvents
  // both do). Say so, rather than print the placeholder noon we stored.
  if (allDay) return "Time not listed";
  const start = formatTime(startIso);
  if (!endIso) return start;
  // An event that runs into another day gets both dates in the range;
  // "10:00 AM – 12:00 PM" would read as a two-hour slot.
  if (spansDays(startIso, endIso)) {
    return `${monthFmt.format(new Date(startIso))} ${formatDayNumber(startIso)}, ${start} – ${monthFmt.format(new Date(endIso))} ${formatDayNumber(endIso)}, ${formatTime(endIso)}`;
  }
  return `${start} – ${formatTime(endIso)}`;
}

const longDateNoYearFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: TZ,
});

// "Friday, September 18 – Sunday, September 20, 2026" for a multi-day event,
// or the plain long date when it ends the same day. The year is spelled out
// on both ends only when it changes between them.
export function formatLongDateRange(
  startIso: string,
  endIso?: string | null,
): string {
  if (!spansDays(startIso, endIso)) return formatLongDate(startIso);
  const start = new Date(startIso);
  const end = new Date(endIso!);
  const sameYear = localDateKey(start).slice(0, 4) === localDateKey(end).slice(0, 4);
  return `${sameYear ? longDateNoYearFmt.format(start) : longDateFmt.format(start)} – ${longDateFmt.format(end)}`;
}

// Returns YYYY-MM-DD for a date in the Pleasanton timezone.
export function localDateKey(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

// Day-of-week (0=Sun..6=Sat) for an ISO instant, in the Pleasanton timezone.
function localWeekday(iso: string): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: TZ,
  }).format(new Date(iso));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

export function isToday(iso: string): boolean {
  return localDateKey(new Date(iso)) === localDateKey();
}

// "This weekend" = upcoming/in-progress Fri (evening), Sat, or Sun.
export function isThisWeekend(iso: string): boolean {
  const key = localDateKey(new Date(iso));
  const todayKey = localDateKey();

  // Build the set of date keys for the current weekend window.
  const now = new Date();
  const todayWd = localWeekday(now.toISOString());
  const weekendKeys = new Set<string>();
  // Days from today until Friday, Saturday, Sunday of this week.
  for (const target of [5, 6, 0]) {
    const offset = (target - todayWd + 7) % 7;
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    weekendKeys.add(localDateKey(d));
  }
  // Only count weekend days that are today or in the future.
  return weekendKeys.has(key) && key >= todayKey;
}

// Orders events by Pleasanton calendar day, then timed before all-day, then
// start time. All-day events carry a placeholder noon in start_at, so a raw
// timestamp sort put six "time not listed" cards ahead of the 7 PM show.
export function sortByDayAndTime<T extends { start_at: string; all_day?: boolean }>(
  events: T[],
): T[] {
  return events
    .map((event) => ({
      event,
      day: localDateKey(new Date(event.start_at)),
      allDay: event.all_day ? 1 : 0,
      at: new Date(event.start_at).getTime(),
    }))
    .sort(
      (a, b) =>
        (a.day < b.day ? -1 : a.day > b.day ? 1 : 0) ||
        a.allDay - b.allDay ||
        a.at - b.at,
    )
    .map((x) => x.event);
}

export function isUpcoming(iso: string): boolean {
  return new Date(iso).getTime() >= Date.now() - 3 * 60 * 60 * 1000; // 3h grace
}

export function relativeDayLabel(iso: string): string {
  const key = localDateKey(new Date(iso));
  const todayKey = localDateKey();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = localDateKey(tomorrow);
  if (key === todayKey) return "Today";
  if (key === tomorrowKey) return "Tomorrow";
  return formatEventDate(iso);
}

// Event links and images come from scraped third-party pages and from the
// public submit form, so an href built from one is an href chosen by a
// stranger. React refuses `javascript:` but passes `data:` and `vbscript:`
// through untouched. Returns the value only when it is a web URL; render
// paths treat null as "no link" and show their fallback.
export function safeHttpUrl(v: string | null | undefined): string | null {
  if (!v) return null;
  try {
    const protocol = new URL(v).protocol;
    return protocol === "https:" || protocol === "http:" ? v : null;
  } catch {
    return null;
  }
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
