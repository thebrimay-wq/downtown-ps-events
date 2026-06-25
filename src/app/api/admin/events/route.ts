import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/server";
import { isAuthorized } from "@/lib/auth";

export const runtime = "nodejs";

// Moderation endpoint for scraped/pending events.
// Body: { id, action: "approve" | "reject" | "merge" | "edit",
//         mergeIntoId?, patch? }
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

  let update: Record<string, unknown>;
  switch (action) {
    case "approve":
      update = { status: "approved", duplicate_of: null };
      break;
    case "reject":
      update = { status: "rejected" };
      break;
    case "merge": {
      const mergeIntoId = body.mergeIntoId ? String(body.mergeIntoId) : null;
      if (!mergeIntoId) {
        return NextResponse.json(
          { error: "mergeIntoId is required for merge." },
          { status: 400 },
        );
      }
      // Mark this event as a duplicate of the canonical one and hide it.
      update = { status: "hidden", duplicate_of: mergeIntoId };
      break;
    }
    case "edit": {
      const patch = (body.patch ?? {}) as Record<string, unknown>;
      const allowed = [
        "title",
        "description",
        "start_at",
        "end_at",
        "venue",
        "address",
        "category",
        "price",
        "is_free",
        "is_family_friendly",
        "image_url",
        "ticket_url",
        "tags",
      ];
      update = {};
      for (const key of allowed) {
        if (key in patch) update[key] = patch[key];
      }
      if (Object.keys(update).length === 0) {
        return NextResponse.json(
          { error: "No editable fields supplied." },
          { status: 400 },
        );
      }
      break;
    }
    default:
      return NextResponse.json(
        { error: `Unknown action "${action}".` },
        { status: 400 },
      );
  }

  const { error } = await admin.from("events").update(update).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
