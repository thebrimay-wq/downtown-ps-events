import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// A whole submission is a few hundred bytes; anything larger is not a form.
const MAX_BODY_BYTES = 16 * 1024;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

// Today's date where the events happen, so an evening submission from
// another zone is not refused as "in the past".
function todayInPleasanton(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
}

function isRealDate(ymd: string): boolean {
  if (!DATE_RE.test(ymd)) return false;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Only web links belong in a href that the site will render for other people.
function isHttpUrl(v: string | null): boolean {
  if (!v) return true;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// Public endpoint for community / business event submissions.
export async function POST(req: NextRequest) {
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return bad("Submission is too large.", 413);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body.");
  }

  const title = String(body.title ?? "").trim();
  const event_date = String(body.event_date ?? "").trim();
  const contact_email = String(body.contact_email ?? "").trim();

  if (!title || !event_date || !contact_email) {
    return bad("Title, date, and contact email are required.");
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact_email)) {
    return bad("Please provide a valid contact email.");
  }
  // These checks are what keep a later Approve click from choking on a date
  // that never was one: the moderation route builds a timestamp from
  // event_date and has no recovery when it is malformed.
  if (!isRealDate(event_date)) return bad("Please enter the date as YYYY-MM-DD.");
  if (event_date < todayInPleasanton()) return bad("The event date has already passed.");

  const start_time = str(body.start_time, 10);
  const end_time = str(body.end_time, 10);
  if ((start_time && !TIME_RE.test(start_time)) || (end_time && !TIME_RE.test(end_time))) {
    return bad("Please enter times as HH:MM.");
  }
  if (start_time && end_time && end_time <= start_time) {
    return bad("The end time must be after the start time.");
  }

  const image_url = str(body.image_url, 600);
  const ticket_url = str(body.ticket_url, 600);
  if (!isHttpUrl(image_url) || !isHttpUrl(ticket_url)) {
    return bad("Links must start with https:// or http://.");
  }

  const record = {
    title: title.slice(0, 200),
    description: str(body.description, 2000),
    event_date,
    start_time,
    end_time,
    venue: str(body.venue, 200),
    address: str(body.address, 300),
    category: str(body.category, 60),
    image_url,
    ticket_url,
    price: str(body.price, 60),
    is_family_friendly: Boolean(body.is_family_friendly),
    contact_email: contact_email.slice(0, 200),
    status: "pending" as const,
  };

  const admin = getAdminClient();

  // With no database there is nowhere to put a submission. Say so in words
  // meant for the person who filled in the form; the form shows this message
  // in place of its thank-you.
  if (!admin) {
    return NextResponse.json({
      ok: true,
      persisted: false,
      message:
        "This calendar isn't taking submissions yet, so your event was not saved. Please check back soon.",
    });
  }

  const { error } = await admin.from("submitted_events").insert(record);
  if (error) {
    return NextResponse.json(
      { error: "Could not save your submission. Please try again." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, persisted: true });
}

function str(v: unknown, max: number): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}
