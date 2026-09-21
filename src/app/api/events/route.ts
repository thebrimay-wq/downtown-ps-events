import { NextResponse, type NextRequest } from "next/server";
import { getEvents } from "@/lib/data";

export const runtime = "nodejs";
// The answer depends on the query string, so every request is rendered.
// `revalidate = 300` used to sit here and read as five-minute caching, but
// reading searchParams already made the route dynamic, so it never did
// anything; say so outright. The Cache-Control header below is what lets a
// browser or CDN cache each URL on its own.
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

// A missing or non-numeric limit means the default; a number is clamped to
// [1, MAX_LIMIT]. Without the floor, `?limit=-2` reached Array.slice and
// returned everything but the last two.
function readLimit(raw: string | null): number {
  if (raw === null || raw.trim() === "") return DEFAULT_LIMIT;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(n, 1), MAX_LIMIT);
}

// Public JSON API for approved events. Supports the same filters as the UI.
// `count` is how many events are in this response; `total` is how many
// matched before the limit.
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
  const page = events.slice(0, readLimit(sp.get("limit")));
  return NextResponse.json(
    { count: page.length, total: events.length, events: page },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
  );
}
