"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";

// Jump straight to a month. The prev/next arrows beside this are plain links
// so they work without JavaScript; this select is the shortcut for a long range.
export function MonthPicker({
  months,
  active,
}: {
  months: { key: string; label: string; count: number }[];
  active: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  return (
    <label className="relative">
      <span className="sr-only">Jump to month</span>
      <select
        value={active}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("month", e.target.value);
          startTransition(() => {
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
          });
        }}
        className="min-h-11 cursor-pointer appearance-none rounded-full bg-canvas py-2 pl-4 pr-9 text-sm font-semibold text-ink-soft ring-1 ring-inset ring-ink/10 transition hover:ring-ink/30 hover:text-ink"
      >
        {months.map((m) => (
          <option key={m.key} value={m.key}>
            {m.label} ({m.count})
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
  );
}
