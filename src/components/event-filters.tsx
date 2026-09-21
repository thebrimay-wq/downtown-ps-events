"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState, useEffect, useRef } from "react";
import { CATEGORY_META } from "@/lib/categories";
import { CategoryIcon } from "./category-icon";
import { useFilterTransition } from "./filter-transition";
import { BadgeDollarSign, Baby, CalendarDays, MapPin, X } from "lucide-react";
import { isRealDate, cn } from "@/lib/utils";

const DATE_PRESETS = [
  { key: "", label: "Any date" },
  { key: "today", label: "Today" },
  { key: "weekend", label: "This weekend" },
  { key: "week", label: "Next 7 days" },
];

export function EventFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useFilterTransition();

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [location, setLocation] = useState(searchParams.get("location") ?? "");

  // The params the last navigation asked for. The URL only catches up once
  // the server has answered, which can take seconds, so anything that edits
  // the query in the meantime builds on this rather than on the stale URL.
  // Without it, "Clear all filters" with text in a box reset the URL and
  // then the search debounce rewrote it from the old params, minus only the
  // text — every pill came back.
  const pending = useRef<URLSearchParams | null>(null);

  // The query this component last asked for. When the URL lands on it, the
  // commit is ours and the inputs are left alone: the reader may have typed
  // more since, and syncing would wipe those keystrokes. Any other change
  // (back button, a calendar link) is external and the inputs follow it.
  const requested = useRef<string | null>(null);

  // The URL as of the last commit, readable from any closure. The debounced
  // effects below capture `current` from the render that changed the text,
  // and by the time their 300ms elapse the URL may have moved on and
  // `pending` been cleared; reading a stale searchParams there is how
  // "Clear all filters" put the category back. In production the commit
  // lands inside the debounce window, so it happened on every clear.
  const latest = useRef(searchParams);

  useEffect(() => {
    latest.current = searchParams;
    pending.current = null;
    if (searchParams.toString() === requested.current) return;
    setSearch(searchParams.get("search") ?? "");
    setLocation(searchParams.get("location") ?? "");
  }, [searchParams]);

  const current = useCallback(
    () => pending.current ?? new URLSearchParams(latest.current.toString()),
    [],
  );

  const navigate = useCallback(
    (params: URLSearchParams) => {
      pending.current = params;
      const query = params.toString();
      requested.current = query;
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      });
    },
    [router, pathname, startTransition],
  );

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      const params = current();
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      navigate(params);
    },
    [current, navigate],
  );

  // Debounce free-text inputs.
  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== (current().get("search") ?? "")) update({ search });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (location !== (current().get("location") ?? ""))
        update({ location });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const activeCategory = searchParams.get("category") ?? "";
  const activeDate = searchParams.get("date") ?? "";
  // A calendar day link lands here with date=YYYY-MM-DD, which no preset
  // matches; it gets its own pill so the state is visible and clearable.
  const customDate = isRealDate(activeDate) ? activeDate : "";
  const free = searchParams.get("free") === "1";
  const family = searchParams.get("family") === "1";

  // The dataset spans the wider Tri-Valley, so this shortcut narrows it to
  // Pleasanton through the location filter that is already wired up.
  const pleasantonOnly = location.trim().toLowerCase() === "pleasanton";

  const hasFilters =
    activeCategory || activeDate || free || family || search || location;

  return (
    <div
      aria-busy={isPending}
      className="space-y-3.5 rounded-2xl bg-canvas-raised p-4 shadow-card ring-1 ring-ink/10 sm:p-5"
    >
      {/* Search + location */}
      <div className="grid gap-3 sm:grid-cols-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search events, artists, venues…"
          icon="search"
        />
        <SearchInput
          value={location}
          onChange={setLocation}
          placeholder="Filter by venue or address…"
          icon="pin"
        />
      </div>

      {/* Date presets */}
      <PillRow label="Date and price filters">
        {/* First in the row, so it is on screen on a phone without scrolling
            the row; it is the state the reader just chose. */}
        {customDate && (
          <Pill active onClick={() => update({ date: null })}>
            <CalendarDays aria-hidden className="h-4 w-4" strokeWidth={2} />
            {dayLabel(customDate)}
            <X aria-hidden className="-mr-1 h-4 w-4 opacity-70" strokeWidth={2.25} />
            <span className="sr-only">Clear date</span>
          </Pill>
        )}
        {DATE_PRESETS.map((preset) => (
          <Pill
            key={preset.key}
            active={activeDate === preset.key}
            onClick={() => update({ date: preset.key || null })}
          >
            {preset.label}
          </Pill>
        ))}
        <div className="mx-1 w-px shrink-0 self-stretch bg-ink/15" />
        <Pill active={free} onClick={() => update({ free: free ? null : "1" })}>
          <BadgeDollarSign aria-hidden className="h-4 w-4" strokeWidth={2} />
          Free
        </Pill>
        <Pill
          active={family}
          onClick={() => update({ family: family ? null : "1" })}
        >
          <Baby aria-hidden className="h-4 w-4" strokeWidth={2} />
          Kid-friendly
        </Pill>
        <Pill
          active={pleasantonOnly}
          onClick={() => setLocation(pleasantonOnly ? "" : "Pleasanton")}
        >
          <MapPin aria-hidden className="h-4 w-4" strokeWidth={2} />
          Pleasanton only
        </Pill>
      </PillRow>

      {/* Categories */}
      <PillRow label="Category filters">
        <Pill
          active={!activeCategory}
          onClick={() => update({ category: null })}
        >
          All categories
        </Pill>
        {Object.entries(CATEGORY_META)
          .filter(([slug]) => slug !== "other")
          .map(([slug, meta]) => (
            <Pill
              key={slug}
              active={activeCategory === slug}
              onClick={() =>
                update({ category: activeCategory === slug ? null : slug })
              }
            >
              <CategoryIcon slug={slug} />
              {meta.label}
            </Pill>
          ))}
      </PillRow>

      {hasFilters && (
        <button
          onClick={() => {
            setSearch("");
            setLocation("");
            navigate(new URLSearchParams());
          }}
          className="inline-flex items-center gap-1.5 rounded-full px-1 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2.25} />
          Clear all filters
        </button>
      )}
    </div>
  );
}

// "Wed, Sep 24" for a YYYY-MM-DD key. Noon keeps the day stable in any
// browser timezone.
function dayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(y, m - 1, d, 12));
}

// A row of pills that scrolls sideways on a phone and wraps from md up. The
// scrollbar is hidden, so a fade over the right edge is what says there is
// more; it goes once the row wraps. The row itself takes focus so arrow keys
// can scroll it, and tabbing to a pill scrolls it into view anyway.
function PillRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative -mx-1 after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-10 after:bg-gradient-to-l after:from-canvas-raised after:to-transparent md:after:hidden">
      <div
        role="group"
        aria-label={label}
        tabIndex={0}
        className="flex gap-2 overflow-x-auto no-scrollbar rounded-lg px-1 pb-1 md:flex-wrap md:overflow-visible"
      >
        {children}
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold transition duration-200",
        active
          ? "bg-ink text-white shadow-card"
          : "bg-canvas text-ink-soft ring-1 ring-inset ring-ink/10 hover:ring-ink/30 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  icon: "search" | "pin";
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
        {icon === "search" ? (
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        )}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-11 w-full rounded-xl border-0 bg-canvas py-2.5 pl-10 pr-4 text-base text-ink ring-1 ring-inset ring-ink/10 placeholder:text-ink-muted transition focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </div>
  );
}
