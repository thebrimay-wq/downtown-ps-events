import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/server";
import { isAuthorized } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { dedupeHash } from "@/lib/dedupe";
import type { SubmittedEvent } from "@/lib/types";

export const runtime = "nodejs";

// Moderation endpoint for community submissions.
// Body: { id, action: "approve" | "reject", review_notes? }
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Supabase service role not configured." },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  const action = String(body.action ?? "");
  if (!id || !action) {
    return NextResponse.json(
      { error: "id and action are required." },
      { status: 400 },
    );
  }

  if (action === "reject") {
    const { error } = await admin
      .from("submitted_events")
      .update({ status: "rejected", review_notes: body.review_notes ?? null })
      .eq("id", id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action !== "approve") {
    return NextResponse.json(
      { error: `Unknown action "${action}".` },
      { status: 400 },
    );
  }

  // Approve: build a published event from the submission.
  const { data: sub, error: fetchErr } = await admin
    .from("submitted_events")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr || !sub) {
    return NextResponse.json(
      { error: "Submission not found." },
      { status: 404 },
    );
  }
  const submission = sub as SubmittedEvent;

  const startAt = combineDateTime(
    submission.event_date,
    submission.start_time,
  );
  const endAt = submission.end_time
    ? combineDateTime(submission.event_date, submission.end_time)
    : null;

  const hash = dedupeHash({
    title: submission.title,
    start_at: startAt,
    venue: submission.venue,
  });

  const eventRow = {
    title: submission.title,
    slug: `${slugify(submission.title)}-${hash.slice(0, 6)}`,
    description: submission.description,
    start_at: startAt,
    end_at: endAt,
    venue: submission.venue,
    address: submission.address,
    category: submission.category ?? "other",
    price: submission.price,
    is_free: /free/i.test(submission.price ?? ""),
    is_family_friendly: Boolean(submission.is_family_friendly),
    image_url: submission.image_url,
    ticket_url: submission.ticket_url,
    source_url: submission.ticket_url,
    status: "approved",
    origin: "submission",
    dedupe_hash: hash,
  };

  const { data: created, error: insertErr } = await admin
    .from("events")
    .insert(eventRow)
    .select("id")
    .single();
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  await admin
    .from("submitted_events")
    .update({
      status: "approved",
      published_event_id: created.id,
      review_notes: body.review_notes ?? null,
    })
    .eq("id", id);

  return NextResponse.json({ ok: true, event_id: created.id });
}

// Combine a YYYY-MM-DD date and optional HH:MM time into a Pacific ISO string.
function combineDateTime(date: string, time?: string | null): string {
  const t = time && /^\d{2}:\d{2}/.test(time) ? time : "18:00";
  // Construct an explicit Pacific-offset timestamp. Determine offset by month
  // (rough DST heuristic: PDT roughly Mar–Nov). Good enough for display.
  const month = Number(date.slice(5, 7));
  const offset = month >= 3 && month <= 11 ? "-07:00" : "-08:00";
  const iso = `${date}T${t.length === 5 ? `${t}:00` : t}${offset}`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? new Date(`${date}T18:00:00${offset}`).toISOString() : d.toISOString();
}
