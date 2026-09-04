/**
 * Health check for a connected Supabase project.
 *
 *   npm run verify
 *
 * Confirms the anon key sees what it should and nothing it shouldn't. The
 * public site ships that key to every browser, so row-level security is the
 * only thing standing between a visitor and unmoderated rows — this asserts
 * it actually works rather than assuming it.
 */
import { createClient } from "@supabase/supabase-js";
import { ALL_DAY_TAG } from "../src/lib/tags";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error("\n  Need all three Supabase values in .env.local.\n");
  process.exit(1);
}

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

let failures = 0;
function check(label: string, passed: boolean, detail = "") {
  if (!passed) failures++;
  console.log(`  [${passed ? "PASS" : "FAIL"}] ${label}${detail ? "  — " + detail : ""}`);
}

async function main() {
  const probe = `rls-probe-${Date.now()}`;

  // Plant a pending event that only the service role should be able to see.
  const { error: insErr } = await admin.from("events").insert({
    title: "RLS probe (should be invisible)",
    slug: probe,
    start_at: new Date(Date.now() + 864e5).toISOString(),
    status: "pending",
    origin: "manual",
  });
  if (insErr) {
    console.error("could not plant probe:", insErr.message);
    process.exit(1);
  }

  try {
    const { count: approved } = await anon
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved");
    check("anon reads approved events", (approved ?? 0) > 1000, `${approved} rows`);

    const { data: leaked } = await anon.from("events").select("id").eq("slug", probe);
    check(
      "anon CANNOT read a pending event",
      (leaked?.length ?? 0) === 0,
      leaked?.length ? "LEAKED — RLS is not filtering" : "hidden, as intended",
    );

    const { data: cats } = await anon.from("event_categories").select("slug");
    check("anon reads categories", (cats?.length ?? 0) === 11, `${cats?.length} rows`);

    const { data: srcs } = await anon.from("sources").select("slug, enabled");
    const enabled = (srcs ?? []).filter((s) => s.enabled).length;
    check("anon reads sources", (srcs?.length ?? 0) === 22, `${srcs?.length} rows`);
    check("only the 7 live sources are enabled", enabled === 7, `${enabled} enabled`);

    const { error: writeErr } = await anon
      .from("events")
      .update({ title: "should not persist" })
      .eq("slug", probe);
    const { data: after } = await admin.from("events").select("title").eq("slug", probe).single();
    check(
      "anon CANNOT write to events",
      !!writeErr || after?.title === "RLS probe (should be invisible)",
      writeErr ? "rejected" : "no rows matched",
    );

    const { count: noImage } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .is("image_url", null)
      .neq("slug", probe); // the probe row is ours, and has no image
    check("every event has an image", (noImage ?? 0) === 0, `${noImage} without`);

    const { count: allDay } = await anon
      .from("events")
      .select("id", { count: "exact", head: true })
      .contains("tags", [ALL_DAY_TAG]);
    check(
      "date-only events keep their all_day flag",
      (allDay ?? 0) > 100,
      `${allDay} all-day (a 0 here means the UI invents 12:00 PM times)`,
    );

    // PostgREST truncates at 1,000 rows without raising an error, so a naive
    // select silently drops everything past the thousandth event.
    const { count: totalApproved } = await anon
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved");
    const { data: unpaged } = await anon
      .from("events")
      .select("id")
      .eq("status", "approved")
      .order("start_at", { ascending: true });
    let paged = 0;
    for (let from = 0; ; from += 1000) {
      const { data } = await anon
        .from("events")
        .select("id")
        .eq("status", "approved")
        .order("start_at", { ascending: true })
        .range(from, from + 999);
      paged += data?.length ?? 0;
      if (!data || data.length < 1000) break;
    }
    check(
      "paging reaches every approved event",
      paged === (totalApproved ?? -1),
      `${paged} paged vs ${totalApproved} total (one unpaged select returns ${unpaged?.length})`,
    );

    const { count: future } = await anon
      .from("events")
      .select("id", { count: "exact", head: true })
      .gte("start_at", new Date().toISOString());
    check("upcoming events are readable", (future ?? 0) > 500, `${future} upcoming`);
  } finally {
    await admin.from("events").delete().eq("slug", probe);
  }

  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Verify crashed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
