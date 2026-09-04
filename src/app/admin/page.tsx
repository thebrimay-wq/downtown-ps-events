import type { Metadata } from "next";
import {
  getPendingEvents,
  getSubmittedEvents,
  getSources,
  getScrapeLogs,
  usingBundledData,
} from "@/lib/data";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { BundledDataBanner } from "@/components/bundled-data-banner";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [pending, submissions, sources, logs] = await Promise.all([
    getPendingEvents(),
    getSubmittedEvents(),
    getSources(),
    getScrapeLogs(),
  ]);

  return (
    <div>
      {usingBundledData() && <BundledDataBanner />}
      <div className="container-page py-10">
        <div className="mb-8">
          <h1 className="display text-[2rem] text-ink sm:text-[2.75rem]">
            Admin dashboard
          </h1>
          <p className="mt-1 text-ink-muted">
            Review scraped &amp; submitted events, manage sources, and monitor
            scrape runs.
          </p>
        </div>
        <AdminDashboard
          initialPending={pending}
          initialSubmissions={submissions}
          sources={sources}
          logs={logs}
          bundledMode={usingBundledData()}
        />
      </div>
    </div>
  );
}
