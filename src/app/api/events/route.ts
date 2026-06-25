import { NextResponse, type NextRequest } from "next/server";
import { getEvents } from "@/lib/data";

export const runtime = "nodejs";
export const revalidate = 300;

// Public JSON API for approved events. Supports the same filters as the UI.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const events = await getEvents({
    category: sp.get("category") ?? undefined,
    search: sp.get("search") ?? undefined,
    location: sp.get("location") ?? undefined,
    free: sp.get("free") === "1",
    familyFriendly: sp.get("family") === "1",
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
  });
  const limit = Math.min(Number(sp.get("limit")) || 100, 200);
  return NextResponse.json({ count: events.length, events: events.slice(0, limit) });
}
