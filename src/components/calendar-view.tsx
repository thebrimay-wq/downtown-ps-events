import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { EventRecord } from "@/lib/types";
import { categoryMeta } from "@/lib/categories";
import { localDateKey } from "@/lib/utils";
import { MonthPicker } from "./month-picker";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const monthLabelFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const pad = (n: number) => String(n).padStart(2, "0");

function labelFor(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return monthLabelFmt.format(new Date(Date.UTC(y, m - 1, 1)));
}

export type SearchParams = Record<string, string | string[] | undefined>;

function hrefWithMonth(params: SearchParams, monthKey: string): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "month" || value === undefined) continue;
    next.set(key, Array.isArray(value) ? (value[0] ?? "") : value);
  }
  next.set("month", monthKey);
  return `/events?${next.toString()}`;
}

/**
 * A month grid with navigation. Only months that actually contain events are
 * reachable — the arrows and the picker are built from the filtered set, so
 * narrowing to one category never strands the reader on an empty grid.
 */
export function CalendarView({
  events,
  month,
  params = {},
}: {
  events: EventRecord[];
  month?: string;
  params?: SearchParams;
}) {
  // Bucket by Pacific date, so an evening event never lands on the wrong day.
  const byDay = new Map<string, EventRecord[]>();
  for (const e of events) {
    const key = localDateKey(new Date(e.start_at));
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
  }

  const countByMonth = new Map<string, number>();
  for (const [day, list] of byDay) {
    const key = day.slice(0, 7);
    countByMonth.set(key, (countByMonth.get(key) ?? 0) + list.length);
  }
  const monthKeys = [...countByMonth.keys()].sort();

  const months = monthKeys.map((key) => ({
    key,
    label: labelFor(key),
    count: countByMonth.get(key) ?? 0,
  }));

  // Prefer the requested month, then the current one, then the earliest with
  // events — so changing filters can never leave a dangling month selected.
  const thisMonth = localDateKey().slice(0, 7);
  const active =
    (month && countByMonth.has(month) && month) ||
    (countByMonth.has(thisMonth) && thisMonth) ||
    monthKeys[0];

  if (!active) return null;

  const index = monthKeys.indexOf(active);
  const prev = index > 0 ? monthKeys[index - 1] : null;
  const next = index < monthKeys.length - 1 ? monthKeys[index + 1] : null;

  const [year, monthNum] = active.split("-").map(Number);
  // Plain calendar arithmetic in UTC, so the grid is identical no matter what
  // timezone the server happens to run in.
  const startWeekday = new Date(Date.UTC(year, monthNum - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  const todayKey = localDateKey();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const keyFor = (day: number) => `${year}-${pad(monthNum)}-${pad(day)}`;
  const activeCount = countByMonth.get(active) ?? 0;

  return (
    <div className="overflow-hidden rounded-3xl bg-canvas-raised shadow-card ring-1 ring-black/[0.07]">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-black/5 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-1">
          <NavArrow
            direction="prev"
            href={prev ? hrefWithMonth(params, prev) : null}
            label={prev ? `Go to ${labelFor(prev)}` : "No earlier events"}
          />
          <NavArrow
            direction="next"
            href={next ? hrefWithMonth(params, next) : null}
            label={next ? `Go to ${labelFor(next)}` : "No later events"}
          />
          <h2 className="display ml-2 text-xl text-ink sm:text-2xl">
            {labelFor(active)}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <span className="tabular text-sm text-ink-muted">
            {activeCount.toLocaleString("en-US")} event
            {activeCount === 1 ? "" : "s"}
          </span>
          {months.length > 1 && <MonthPicker months={months} active={active} />}
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-black/5 bg-canvas-sunken/50 text-center text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2.5">
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d[0]}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null)
            return (
              <div
                key={i}
                className="min-h-[68px] border-b border-r border-black/5 bg-canvas-sunken/30 last:border-r-0 sm:min-h-[116px]"
              />
            );
          const key = keyFor(day);
          const dayEvents = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div
              key={i}
              className="min-h-[68px] space-y-1 border-b border-r border-black/5 p-1.5 [&:nth-child(7n)]:border-r-0 sm:min-h-[116px]"
            >
              <div
                className={
                  isToday
                    ? "tabular ml-auto grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white"
                    : "tabular px-1 text-xs font-semibold text-ink-muted"
                }
              >
                {day}
              </div>

              {/* Phones: coloured dots read as density. Titles truncated to
                  "W…" tell the reader nothing, and a 12px link is well under
                  the 44px minimum tap target. List view carries the detail. */}
              <div
                className="flex flex-wrap gap-1 px-1 sm:hidden"
                aria-label={`${dayEvents.length} event${
                  dayEvents.length === 1 ? "" : "s"
                }`}
              >
                {dayEvents.slice(0, 5).map((e) => (
                  <span
                    key={e.id}
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: categoryMeta(e.category).color }}
                  />
                ))}
                {dayEvents.length > 5 && (
                  <span aria-hidden className="text-[9px] font-bold leading-none text-ink-muted">
                    +{dayEvents.length - 5}
                  </span>
                )}
              </div>

              <div className="hidden space-y-1 sm:block">
                {dayEvents.slice(0, 3).map((e) => {
                  const meta = categoryMeta(e.category);
                  return (
                    <Link
                      key={e.id}
                      href={`/events/${e.slug ?? e.id}`}
                      className="block truncate rounded-lg px-1.5 py-1 text-[11px] font-medium leading-tight transition duration-200 hover:opacity-80"
                      style={{
                        backgroundColor: `${meta.color}1f`,
                        color: meta.color,
                      }}
                      title={e.title}
                    >
                      {e.title}
                    </Link>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="tabular px-1.5 text-[11px] font-medium text-ink-muted">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="border-t border-black/5 px-5 py-3 text-xs text-ink-muted sm:hidden">
        Each dot is one event. Switch to List for titles and times.
      </p>
    </div>
  );
}

// A disabled arrow stays in the layout as a dimmed span rather than vanishing,
// so the header doesn't shift as you reach either end of the range.
function NavArrow({
  direction,
  href,
  label,
}: {
  direction: "prev" | "next";
  href: string | null;
  label: string;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  const shape =
    "grid h-11 w-11 place-items-center rounded-full transition duration-200";

  if (!href) {
    return (
      <span className={`${shape} text-ink-muted opacity-30`} aria-hidden title={label}>
        <Icon className="h-5 w-5" strokeWidth={2.25} />
      </span>
    );
  }
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={label}
      title={label}
      className={`${shape} text-ink-soft hover:bg-black/[0.04] hover:text-ink`}
    >
      <Icon className="h-5 w-5" strokeWidth={2.25} />
    </Link>
  );
}
