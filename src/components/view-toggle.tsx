"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useFilterTransition } from "./filter-transition";

export function ViewToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useFilterTransition();
  const view = searchParams.get("view") === "calendar" ? "calendar" : "list";

  const setView = (next: "list" | "calendar") => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "list") params.delete("view");
    else params.set("view", "calendar");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="inline-flex rounded-full bg-canvas-sunken p-0.5 ring-1 ring-inset ring-ink/10">
      {(["list", "calendar"] as const).map((v) => (
        <button
          key={v}
          onClick={() => setView(v)}
          className={cn(
            "min-h-11 rounded-full px-4 text-sm font-semibold capitalize transition",
            view === v ? "bg-canvas-raised text-ink shadow-card" : "text-ink-muted hover:text-ink",
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
