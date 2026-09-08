"use client";

import { useEffect, useState } from "react";
import type {
  EventRecord,
  ScrapedEventLog,
  Source,
  SubmittedEvent,
} from "@/lib/types";
import { CategoryBadge } from "@/components/category-badge";
import { formatEventDate, formatTimeRange } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Tab = "review" | "submissions" | "sources" | "logs";

const TABS: { key: Tab; label: string }[] = [
  { key: "review", label: "Scraped events" },
  { key: "submissions", label: "Submissions" },
  { key: "sources", label: "Sources" },
  { key: "logs", label: "Scrape logs" },
];

export function AdminDashboard({
  initialPending,
  initialSubmissions,
  sources,
  logs,
  bundledMode,
}: {
  initialPending: EventRecord[];
  initialSubmissions: SubmittedEvent[];
  sources: Source[];
  logs: ScrapedEventLog[];
  bundledMode: boolean;
}) {
  const [tab, setTab] = useState<Tab>("review");
  const [secret, setSecret] = useState("");
  const [pending, setPending] = useState(initialPending);
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Persist the admin secret locally so it survives reloads.
  useEffect(() => {
    const stored = localStorage.getItem("admin_secret");
    if (stored) setSecret(stored);
  }, []);
  useEffect(() => {
    if (secret) localStorage.setItem("admin_secret", secret);
  }, [secret]);

  async function callApi(path: string, body: Record<string, unknown>) {
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": secret,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `Request failed (${res.status})`);
    }
    return res.json();
  }

  async function moderateEvent(id: string, action: "approve" | "reject") {
    setBusy(id);
    setMessage(null);
    try {
      await callApi("/api/admin/events", { id, action });
      setPending((prev) => prev.filter((e) => e.id !== id));
      setMessage(`Event ${action}d.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  async function moderateSubmission(id: string, action: "approve" | "reject") {
    setBusy(id);
    setMessage(null);
    try {
      await callApi("/api/admin/submissions", { id, action });
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
      setMessage(`Submission ${action}d.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  async function triggerScrape() {
    setBusy("scrape");
    setMessage(null);
    try {
      const result = await callApi("/api/scrape", {});
      setMessage(
        `Scrape complete: ${result.created ?? 0} new, ${result.duplicates ?? 0} duplicates flagged. Reload to review.`,
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Scrape failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {/* Secret + scrape controls */}
      <div className="mb-6 flex flex-col gap-3 rounded-3xl bg-canvas-raised p-4 shadow-card ring-1 ring-ink/10 sm:flex-row sm:items-center">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Admin secret
          </span>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Required for actions (ADMIN_SECRET)"
            className="min-h-11 w-full rounded-2xl border-0 bg-canvas-sunken px-4 py-2.5 text-base shadow-sm ring-1 ring-ink/10 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </label>
        <button
          onClick={triggerScrape}
          disabled={busy === "scrape"}
          className="self-end rounded-2xl bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-soft disabled:opacity-60"
        >
          {busy === "scrape" ? "Scraping…" : "Run scrapers now"}
        </button>
      </div>

      {message && (
        <div className="mb-5 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-800 ring-1 ring-brand-200/60">
          {message}
        </div>
      )}

      {bundledMode && (
        <div className="mb-6 rounded-2xl bg-canvas-sunken px-4 py-3 text-sm text-ink-muted">
          No database connected — the site is serving the bundled crawl
          results, so these admin lists are empty. Configure Supabase to manage
          live scraped events, submissions, and sources.
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto no-scrollbar rounded-full bg-canvas-sunken p-1 ring-1 ring-ink/10">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition",
              tab === t.key
                ? "bg-canvas-raised text-ink shadow-sm"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {t.label}
            {t.key === "review" && pending.length > 0 && (
              <span className="ml-1.5 rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {pending.length}
              </span>
            )}
            {t.key === "submissions" && submissions.length > 0 && (
              <span className="ml-1.5 rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {submissions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Panels */}
      {tab === "review" && (
        <Panel
          empty={pending.length === 0}
          emptyText="No scraped events awaiting review."
        >
          {pending.map((e) => (
            <ReviewRow
              key={e.id}
              event={e}
              busy={busy === e.id}
              onApprove={() => moderateEvent(e.id, "approve")}
              onReject={() => moderateEvent(e.id, "reject")}
            />
          ))}
        </Panel>
      )}

      {tab === "submissions" && (
        <Panel
          empty={submissions.length === 0}
          emptyText="No community submissions awaiting review."
        >
          {submissions.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-3 rounded-2xl bg-canvas-raised p-4 shadow-sm ring-1 ring-ink/10 sm:flex-row sm:items-center"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CategoryBadge slug={s.category} />
                  <span className="text-sm text-ink-muted">
                    {s.event_date} {s.start_time && `· ${s.start_time}`}
                  </span>
                </div>
                <h3 className="mt-1.5 font-semibold text-ink">{s.title}</h3>
                {s.venue && (
                  <p className="text-sm text-ink-muted">{s.venue}</p>
                )}
                {s.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-ink-muted">
                    {s.description}
                  </p>
                )}
                <p className="mt-1 text-xs text-ink-muted">
                  Contact: {s.contact_email}
                </p>
              </div>
              <Actions
                busy={busy === s.id}
                onApprove={() => moderateSubmission(s.id, "approve")}
                onReject={() => moderateSubmission(s.id, "reject")}
              />
            </div>
          ))}
        </Panel>
      )}

      {tab === "sources" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {sources.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl bg-canvas-raised p-4 shadow-sm ring-1 ring-ink/10"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-ink">{s.name}</h3>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    s.enabled
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-canvas-sunken text-ink-muted",
                  )}
                >
                  {s.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block truncate text-sm text-brand-700 hover:text-brand-800"
              >
                {s.url}
              </a>
              {s.notes && (
                <p className="mt-2 text-sm text-ink-muted">{s.notes}</p>
              )}
              <div className="mt-3 flex items-center gap-3 text-xs text-ink-muted">
                <span className="rounded bg-canvas-sunken px-2 py-0.5 font-medium">
                  {s.scraper_key}
                </span>
                <span>{s.strategy}</span>
                {s.last_status && <span>· last: {s.last_status}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "logs" && (
        <Panel empty={logs.length === 0} emptyText="No scrape runs recorded yet.">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between rounded-2xl bg-canvas-raised p-4 shadow-sm ring-1 ring-ink/10"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      log.status === "ok"
                        ? "bg-emerald-100 text-emerald-700"
                        : log.status === "error"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700",
                    )}
                  >
                    {log.status}
                  </span>
                  <span className="font-medium text-ink">
                    {log.source_slug ?? "all sources"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {new Date(log.started_at).toLocaleString()}
                </p>
                {log.error_message && (
                  <p className="mt-1 text-xs text-red-600">
                    {log.error_message}
                  </p>
                )}
              </div>
              <div className="text-right text-sm text-ink-muted">
                <p>
                  {log.items_created} new · {log.items_duplicate} dupes
                </p>
                <p className="text-xs text-ink-muted">
                  {log.items_found} found
                </p>
              </div>
            </div>
          ))}
        </Panel>
      )}
    </div>
  );
}

function Panel({
  empty,
  emptyText,
  children,
}: {
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  if (empty) {
    return (
      <div className="rounded-3xl border border-dashed border-ink/15 bg-canvas-raised/50 py-14 text-center text-sm text-ink-muted">
        {emptyText}
      </div>
    );
  }
  return <div className="space-y-3">{children}</div>;
}

function ReviewRow({
  event,
  busy,
  onApprove,
  onReject,
}: {
  event: EventRecord;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-canvas-raised p-4 shadow-sm ring-1 ring-ink/10 sm:flex-row sm:items-center">
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge slug={event.category} />
          {event.duplicate_of && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              ⚠️ Possible duplicate
            </span>
          )}
          <span className="text-sm text-ink-muted">
            {formatEventDate(event.start_at)} ·{" "}
            {formatTimeRange(event.start_at, event.end_at)}
          </span>
        </div>
        <h3 className="mt-1.5 font-semibold text-ink">{event.title}</h3>
        {event.venue && <p className="text-sm text-ink-muted">{event.venue}</p>}
        {event.source_name && (
          <p className="mt-1 text-xs text-ink-muted">
            via {event.source_name}
          </p>
        )}
      </div>
      <Actions busy={busy} onApprove={onApprove} onReject={onReject} />
    </div>
  );
}

function Actions({
  busy,
  onApprove,
  onReject,
}: {
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex shrink-0 gap-2">
      <button
        onClick={onApprove}
        disabled={busy}
        className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
      >
        Approve
      </button>
      <button
        onClick={onReject}
        disabled={busy}
        className="rounded-xl bg-canvas-sunken px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-ink/[0.06] disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}
