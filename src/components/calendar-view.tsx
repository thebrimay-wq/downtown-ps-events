import Link from "next/link";
import type { EventRecord } from "@/lib/types";
import { categoryMeta } from "@/lib/categories";
import { localDateKey } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Renders a month grid. Defaults to the month of the earliest event, or the
// current month if there are no events.
export function CalendarView({ events }: { events: EventRecord[] }) {
  const anchor =
    events.length > 0 ? new Date(events[0].start_at) : new Date();
  const year = anchor.getFullYear();
  const month = anchor.getMonth();

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month, 1));

  // Bucket events by local date key.
  const byDay = new Map<string, EventRecord[]>();
  for (const e of events) {
    const key = localDateKey(new Date(e.start_at));
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
  }

  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = localDateKey();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const keyFor = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return (
    <div className="overflow-hidden rounded-3xl bg-canvas-raised shadow-card ring-1 ring-black/[0.04]">
      <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
        <h2 className="text-lg font-semibold tracking-tight">{monthLabel}</h2>
        <span className="text-sm text-ink-muted">
          {events.length} event{events.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-7 border-b border-black/5 bg-canvas-sunken/50 text-center text-xs font-semibold uppercase tracking-wide text-ink-faint">
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
                className="min-h-[84px] border-b border-r border-black/5 bg-canvas-sunken/30 last:border-r-0"
              />
            );
          const key = keyFor(day);
          const dayEvents = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div
              key={i}
              className="min-h-[84px] space-y-1 border-b border-r border-black/5 p-1.5 [&:nth-child(7n)]:border-r-0 sm:min-h-[116px]"
            >
              <div
                className={
                  isToday
                    ? "ml-auto grid h-6 w-6 place-items-center rounded-full bg-brand-500 text-xs font-bold text-white"
                    : "px-1 text-xs font-semibold text-ink-muted"
                }
              >
                {day}
              </div>
              {dayEvents.slice(0, 3).map((e) => {
                const meta = categoryMeta(e.category);
                return (
                  <Link
                    key={e.id}
                    href={`/events/${e.slug ?? e.id}`}
                    className="block truncate rounded-lg px-1.5 py-1 text-[11px] font-medium leading-tight transition hover:opacity-80"
                    style={{
                      backgroundColor: `${meta.color}1a`,
                      color: meta.color,
                    }}
                    title={e.title}
                  >
                    {e.title}
                  </Link>
                );
              })}
              {dayEvents.length > 3 && (
                <div className="px-1.5 text-[11px] font-medium text-ink-faint">
                  +{dayEvents.length - 3} more
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
