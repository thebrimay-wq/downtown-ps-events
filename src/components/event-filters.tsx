"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState, useEffect, useTransition } from "react";
import { CATEGORY_META } from "@/lib/categories";
import { cn } from "@/lib/utils";

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
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [location, setLocation] = useState(searchParams.get("location") ?? "");

  // Keep local inputs in sync if the URL changes externally (e.g. back button).
  useEffect(() => {
    setSearch(searchParams.get("search") ?? "");
    setLocation(searchParams.get("location") ?? "");
  }, [searchParams]);

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [router, pathname, searchParams],
  );

  // Debounce free-text inputs.
  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== (searchParams.get("search") ?? "")) update({ search });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (location !== (searchParams.get("location") ?? ""))
        update({ location });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const activeCategory = searchParams.get("category") ?? "";
  const activeDate = searchParams.get("date") ?? "";
  const free = searchParams.get("free") === "1";
  const family = searchParams.get("family") === "1";

  const hasFilters =
    activeCategory || activeDate || free || family || search || location;

  return (
    <div className="space-y-4">
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
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {DATE_PRESETS.map((preset) => (
          <Pill
            key={preset.key}
            active={activeDate === preset.key}
            onClick={() => update({ date: preset.key || null })}
          >
            {preset.label}
          </Pill>
        ))}
        <div className="mx-1 w-px shrink-0 self-stretch bg-black/10" />
        <Pill active={free} onClick={() => update({ free: free ? null : "1" })}>
          💸 Free
        </Pill>
        <Pill
          active={family}
          onClick={() => update({ family: family ? null : "1" })}
        >
          🧸 Kid-friendly
        </Pill>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
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
              <span aria-hidden>{meta.icon}</span> {meta.label}
            </Pill>
          ))}
      </div>

      {hasFilters && (
        <button
          onClick={() => {
            setSearch("");
            setLocation("");
            startTransition(() => router.replace(pathname, { scroll: false }));
          }}
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Clear all filters
        </button>
      )}
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
        "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition",
        active
          ? "bg-ink text-white shadow-sm"
          : "bg-canvas-raised text-ink-soft ring-1 ring-black/[0.06] hover:bg-black/[0.03]",
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
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
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
        className="w-full rounded-2xl border-0 bg-canvas-raised py-2.5 pl-10 pr-4 text-sm text-ink shadow-sm ring-1 ring-black/[0.06] placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
    </div>
  );
}
