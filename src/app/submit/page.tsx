import type { Metadata } from "next";
import { SubmitForm } from "@/components/submit-form";
import { CATEGORY_META } from "@/lib/categories";
import { Megaphone } from "lucide-react";

export const metadata: Metadata = {
  title: "Submit an Event",
  description:
    "Local businesses and community members can submit an event to the Pleasanton Events Hub for review.",
};

export default function SubmitPage() {
  const categories = Object.entries(CATEGORY_META).map(([slug, meta]) => ({
    slug,
    label: meta.label,
  }));

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <p className="flex items-center justify-center gap-1.5 text-sm font-semibold uppercase tracking-[0.1em] text-brand-600">
            <Megaphone aria-hidden className="h-4 w-4" strokeWidth={2.25} />
            Community submissions
          </p>
          <h1 className="display mt-3 text-[2rem] text-ink sm:text-[2.75rem]">
            Submit an event
          </h1>
          <p className="mx-auto mt-4 max-w-lg leading-relaxed text-ink-muted">
            Hosting something in Pleasanton? Tell us about it. Submissions are
            reviewed by our team before appearing on the calendar.
          </p>
        </div>

        <div className="mt-8 rounded-3xl bg-canvas-raised p-6 shadow-card ring-1 ring-ink/10 sm:p-8">
          <SubmitForm categories={categories} />
        </div>
      </div>
    </div>
  );
}
