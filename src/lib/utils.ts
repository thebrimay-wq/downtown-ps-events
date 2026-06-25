import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TZ = "America/Los_Angeles";

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

export function formatTimeRange(startIso: string, endIso?: string | null): string {
  const start = formatTime(startIso);
  if (!endIso) return start;
  return `${start} – ${formatTime(endIso)}`;
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

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
