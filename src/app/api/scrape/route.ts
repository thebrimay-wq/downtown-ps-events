import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/server";
import { isAuthorized } from "@/lib/auth";
import { runScrapers } from "@/lib/scrapers";
import type { Source } from "@/lib/types";

export const runtime = "nodejs";
// Scraping can take a while across many sources.
export const maxDuration = 300;

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      {
        error:
          "Scraping requires Supabase service-role configuration (SUPABASE_SERVICE_ROLE_KEY).",
      },
      { status: 503 },
    );
  }

  const { data: sources, error } = await admin
    .from("sources")
    .select("*")
    .eq("enabled", true);

  if (error) {
    return NextResponse.json(
      { error: `Failed to load sources: ${error.message}` },
      { status: 500 },
    );
  }

  const summary = await runScrapers(admin, (sources ?? []) as Source[]);
  return NextResponse.json({ ok: true, ...summary });
}

// POST: triggered from the admin dashboard.
export async function POST(req: NextRequest) {
  return handle(req);
}

// GET: triggered by Vercel Cron / GitHub Actions (auth via ?secret= or Bearer).
export async function GET(req: NextRequest) {
  return handle(req);
}
