"use client";

import type { EventRecord } from "@/lib/types";

// Formats a Date as an iCalendar UTC timestamp: YYYYMMDDTHHMMSSZ.
function toICSDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// The calendar date an ISO string names in its own zone, as YYYYMMDD. Taken
// from the text rather than a Date so a 7 PM Pacific start does not become
// the next day once it is read back in UTC.
function toICSDay(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "");
}

function nextICSDay(yyyymmdd: string): string {
  const y = Number(yyyymmdd.slice(0, 4));
  const m = Number(yyyymmdd.slice(4, 6));
  const d = Number(yyyymmdd.slice(6, 8));
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10).replace(/-/g, "");
}

// Text values per RFC 5545: backslash, semicolon and comma are escaped, a
// newline becomes the literal \n, and a bare carriage return is dropped so
// no value can start a new property line of its own.
function escapeICS(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function AddToCalendar({ event }: { event: EventRecord }) {
  const handleDownload = () => {
    // An all-day event's start_at carries a placeholder clock time the page
    // deliberately does not show. Writing it into the file would put an
    // invented 12:00 PM in the reader's calendar, so those go out as
    // VALUE=DATE, whose DTEND is the day after the last day (exclusive).
    let when: string[];
    if (event.all_day) {
      const first = toICSDay(event.start_at);
      const last = event.end_at ? toICSDay(event.end_at) : first;
      when = [`DTSTART;VALUE=DATE:${first}`, `DTEND;VALUE=DATE:${nextICSDay(last)}`];
    } else {
      const end = event.end_at
        ? event.end_at
        : new Date(
            new Date(event.start_at).getTime() + 2 * 60 * 60 * 1000,
          ).toISOString();
      when = [`DTSTART:${toICSDate(event.start_at)}`, `DTEND:${toICSDate(end)}`];
    }

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Pleasanton Events Hub//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${event.id}@pleasanton-events-hub`,
      `DTSTAMP:${toICSDate(new Date().toISOString())}`,
      ...when,
      `SUMMARY:${escapeICS(event.title)}`,
      event.description
        ? `DESCRIPTION:${escapeICS(event.description)}`
        : "",
      event.address || event.venue
        ? `LOCATION:${escapeICS([event.venue, event.address].filter(Boolean).join(", "))}`
        : "",
      event.source_url ? `URL:${event.source_url.replace(/[\r\n]/g, "")}` : "",
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean);

    const blob = new Blob([lines.join("\r\n")], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.slug ?? "event"}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleDownload}
      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white shadow-card transition hover:bg-ink-soft active:scale-[0.98]"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" />
      </svg>
      Add to calendar
    </button>
  );
}
