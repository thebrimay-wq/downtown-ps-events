"use client";

import type { EventRecord } from "@/lib/types";

// Formats a Date as an iCalendar UTC timestamp: YYYYMMDDTHHMMSSZ.
function toICSDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function AddToCalendar({ event }: { event: EventRecord }) {
  const handleDownload = () => {
    const end = event.end_at
      ? event.end_at
      : new Date(
          new Date(event.start_at).getTime() + 2 * 60 * 60 * 1000,
        ).toISOString();

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Pleasanton Events Hub//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${event.id}@pleasanton-events-hub`,
      `DTSTAMP:${toICSDate(new Date().toISOString())}`,
      `DTSTART:${toICSDate(event.start_at)}`,
      `DTEND:${toICSDate(end)}`,
      `SUMMARY:${escapeICS(event.title)}`,
      event.description
        ? `DESCRIPTION:${escapeICS(event.description)}`
        : "",
      event.address || event.venue
        ? `LOCATION:${escapeICS([event.venue, event.address].filter(Boolean).join(", "))}`
        : "",
      event.source_url ? `URL:${event.source_url}` : "",
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
