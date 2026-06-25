import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Public endpoint for community / business event submissions.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  const event_date = String(body.event_date ?? "").trim();
  const contact_email = String(body.contact_email ?? "").trim();

  if (!title || !event_date || !contact_email) {
    return NextResponse.json(
      { error: "Title, date, and contact email are required." },
      { status: 400 },
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact_email)) {
    return NextResponse.json(
      { error: "Please provide a valid contact email." },
      { status: 400 },
    );
  }

  const record = {
    title: title.slice(0, 200),
    description: str(body.description, 2000),
    event_date,
    start_time: str(body.start_time, 10),
    end_time: str(body.end_time, 10),
    venue: str(body.venue, 200),
    address: str(body.address, 300),
    category: str(body.category, 60),
    image_url: str(body.image_url, 600),
    ticket_url: str(body.ticket_url, 600),
    price: str(body.price, 60),
    is_family_friendly: Boolean(body.is_family_friendly),
    contact_email: contact_email.slice(0, 200),
    status: "pending" as const,
  };

  const admin = getAdminClient();

  // In demo mode (no Supabase) accept the submission so the UX works, but make
  // clear it isn't persisted.
  if (!admin) {
    return NextResponse.json({
      ok: true,
      persisted: false,
      message:
        "Demo mode: submission received but not stored (Supabase not configured).",
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
