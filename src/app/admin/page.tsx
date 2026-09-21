import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  getPendingEvents,
  getSubmittedEvents,
  getSources,
  getScrapeLogs,
  usingBundledData,
} from "@/lib/data";
import {
  ADMIN_SESSION_COOKIE,
  adminSecretConfigured,
  isValidSessionToken,
} from "@/lib/auth";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { AdminSignIn } from "@/components/admin/admin-sign-in";
import { BundledDataBanner } from "@/components/bundled-data-banner";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Submissions carry contact emails, so nothing is loaded, let alone
  // rendered, until the session cookie checks out. Row-level security is not
  // the thing standing between a submitter's email and the public internet.
  const cookieStore = await cookies();
  const authorized = await isValidSessionToken(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  );

  const data = authorized
    ? await Promise.all([
        getPendingEvents(),
        getSubmittedEvents(),
        getSources(),
        getScrapeLogs(),
      ])
    : null;

  return (
    <div>
      {usingBundledData() && <BundledDataBanner />}
      <div className="container-page py-10">
        <div className="mb-8">
          <h1 className="display text-[2rem] text-ink sm:text-[2.75rem]">
            Admin dashboard
          </h1>
          <p className="mt-1 text-ink-muted">
            {data
              ? "Review scraped & submitted events, manage sources, and monitor scrape runs."
              : "Sign in with the admin secret to review events and run scrapers."}
          </p>
        </div>
        {data ? (
          <AdminDashboard
            initialPending={data[0]}
            initialSubmissions={data[1]}
            sources={data[2]}
            logs={data[3]}
            bundledMode={usingBundledData()}
          />
        ) : (
          <AdminSignIn configured={adminSecretConfigured()} />
        )}
      </div>
    </div>
  );
}
