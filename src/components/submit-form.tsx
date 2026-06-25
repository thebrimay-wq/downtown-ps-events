"use client";

import { useState } from "react";

interface CategoryOption {
  slug: string;
  label: string;
}

type Status = "idle" | "submitting" | "success" | "error";

export function SubmitForm({ categories }: { categories: CategoryOption[] }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          is_family_friendly: data.is_family_friendly === "on",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Something went wrong. Please try again.");
      }
      setStatus("success");
      form.reset();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Submission failed.");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-2xl">
          ✓
        </div>
        <h2 className="mt-4 text-xl font-semibold text-ink">
          Thanks — we got it!
        </h2>
        <p className="mt-2 max-w-sm text-ink-muted">
          Your event has been submitted for review. Our team will take a look
          and publish it to the calendar soon.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-6 rounded-2xl bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-soft"
        >
          Submit another event
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Event title" required>
        <input name="title" required maxLength={200} className={inputClass} placeholder="e.g. Downtown Summer Concert" />
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Date" required>
          <input type="date" name="event_date" required className={inputClass} />
        </Field>
        <Field label="Start time">
          <input type="time" name="start_time" className={inputClass} />
        </Field>
        <Field label="End time">
          <input type="time" name="end_time" className={inputClass} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Venue">
          <input name="venue" maxLength={200} className={inputClass} placeholder="e.g. Firehouse Arts Center" />
        </Field>
        <Field label="Category">
          <select name="category" defaultValue="" className={inputClass}>
            <option value="" disabled>
              Choose a category…
            </option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Address">
        <input name="address" maxLength={300} className={inputClass} placeholder="Street, Pleasanton, CA" />
      </Field>

      <Field label="Description">
        <textarea
          name="description"
          rows={4}
          maxLength={2000}
          className={inputClass}
          placeholder="Tell attendees what to expect…"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Image URL">
          <input type="url" name="image_url" className={inputClass} placeholder="https://…" />
        </Field>
        <Field label="Ticket / info URL">
          <input type="url" name="ticket_url" className={inputClass} placeholder="https://…" />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Price">
          <input name="price" maxLength={60} className={inputClass} placeholder="e.g. Free, $10, $5–$20" />
        </Field>
        <Field label="Contact email" required>
          <input type="email" name="contact_email" required className={inputClass} placeholder="you@example.com" />
        </Field>
      </div>

      <label className="flex items-center gap-3 rounded-2xl bg-canvas-sunken px-4 py-3">
        <input
          type="checkbox"
          name="is_family_friendly"
          className="h-4 w-4 rounded border-black/20 text-brand-500 focus:ring-brand-400"
        />
        <span className="text-sm font-medium text-ink-soft">
          🧸 This event is family / kid-friendly
        </span>
      </label>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-2xl bg-brand-500 px-5 py-3.5 text-sm font-semibold text-white shadow-card transition hover:bg-brand-600 active:scale-[0.99] disabled:opacity-60"
      >
        {status === "submitting" ? "Submitting…" : "Submit event for review"}
      </button>
      <p className="text-center text-xs text-ink-faint">
        By submitting, you confirm this event is accurate and open to the public.
      </p>
    </form>
  );
}

const inputClass =
  "w-full rounded-2xl border-0 bg-canvas-sunken px-4 py-2.5 text-sm text-ink shadow-sm ring-1 ring-black/[0.06] placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-400";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-soft">
        {label}
        {required && <span className="text-brand-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
