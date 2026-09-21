"use client";

import Link, { useLinkStatus } from "next/link";
import { ChevronDown } from "lucide-react";

// The list is cut at `limit` cards and this link raises it. A plain link
// rather than a button, so the longer page is a URL that can be shared or
// reopened, and the whole thing works before hydration.
export function ShowMore({
  href,
  step,
  shown,
  total,
}: {
  href: string;
  step: number;
  shown: number;
  total: number;
}) {
  return (
    <div className="flex flex-col items-center gap-3 border-t border-ink/10 pt-8">
      <p className="tabular text-sm text-ink-muted">
        Showing {shown.toLocaleString("en-US")} of {total.toLocaleString("en-US")}
      </p>
      <Link
        href={href}
        scroll={false}
        className="inline-flex min-h-12 items-center gap-2 rounded-full bg-canvas-raised px-6 text-sm font-semibold text-ink ring-1 ring-ink/10 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
      >
        <Label step={step} />
      </Link>
    </div>
  );
}

// Reads the link's own navigation state, so the button says it is working
// without a client transition of its own.
function Label({ step }: { step: number }) {
  const { pending } = useLinkStatus();
  if (pending) return <>Loading…</>;
  return (
    <>
      Show {step.toLocaleString("en-US")} more
      <ChevronDown aria-hidden className="h-4 w-4" strokeWidth={2.25} />
    </>
  );
}
