"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// The only thing an anonymous visitor to /admin sees. The secret goes to the
// session route once and is not kept anywhere in the browser; the httpOnly
// cookie it answers with is what the server reads on the refresh.
export function AdminSignIn({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!secret) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Sign-in failed (${res.status})`);
      }
      setSecret("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md rounded-3xl bg-canvas-raised p-6 shadow-card ring-1 ring-ink/10">
      {!configured && (
        <div className="mb-5 rounded-2xl bg-canvas-sunken px-4 py-3 text-sm text-ink-muted">
          This site has no admin secret configured, so nobody can sign in.
          Set <code className="font-mono text-xs">ADMIN_SECRET</code> on the
          Worker (or in <code className="font-mono text-xs">.env.local</code>{" "}
          for local development) and reload.
        </div>
      )}
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Admin secret
          </span>
          <input
            type="password"
            autoComplete="current-password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="ADMIN_SECRET"
            className="min-h-11 w-full rounded-2xl border-0 bg-canvas-sunken px-4 py-2.5 text-base shadow-sm ring-1 ring-ink/10 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !secret}
          className="self-start rounded-2xl bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-soft disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      {error && (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200/60">
          {error}
        </p>
      )}
    </div>
  );
}
