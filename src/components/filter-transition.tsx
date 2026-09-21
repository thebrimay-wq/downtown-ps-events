"use client";

import {
  createContext,
  useContext,
  useTransition,
  type ReactNode,
  type TransitionStartFunction,
} from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// One transition for every control that rewrites the /events URL. The filter
// pills, the month picker and the view toggle all start it; the results
// region and the count read it. Without this, tapping a pill turned it black
// and then left the old results frozen on screen for as long as the server
// took to answer, with nothing to say a request was in flight.
// ---------------------------------------------------------------------------

type FilterTransition = [isPending: boolean, startTransition: TransitionStartFunction];

const Ctx = createContext<FilterTransition | null>(null);

export function FilterTransitionProvider({ children }: { children: ReactNode }) {
  const transition = useTransition();
  return <Ctx.Provider value={transition}>{children}</Ctx.Provider>;
}

// Falls back to a private transition outside the provider, so a control still
// works on a page that never wired one up.
export function useFilterTransition(): FilterTransition {
  const shared = useContext(Ctx);
  const own = useTransition();
  return shared ?? own;
}

// Dims and disables the results while a new set is on its way.
export function FilterResults({ children }: { children: ReactNode }) {
  const [isPending] = useFilterTransition();
  return (
    <div
      aria-busy={isPending}
      className={cn(
        "transition-opacity duration-200",
        isPending && "pointer-events-none opacity-60",
      )}
    >
      {children}
    </div>
  );
}

// The "N upcoming events" line in the page header, which says so while the
// count is being recomputed.
export function FilterCount({ total }: { total: number }) {
  const [isPending] = useFilterTransition();
  if (isPending) {
    return (
      <span className="font-semibold text-ink-soft" aria-live="polite">
        Filtering…
      </span>
    );
  }
  return (
    <>
      <span className="tabular font-semibold text-ink-soft">
        {total.toLocaleString("en-US")}
      </span>{" "}
      upcoming event{total === 1 ? "" : "s"}
    </>
  );
}
