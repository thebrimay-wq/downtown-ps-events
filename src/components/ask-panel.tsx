"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { useAsk } from "./ask-context";
import { AskChat } from "./ask-chat";
import { cn } from "@/lib/utils";
import meta from "@/lib/dataset-meta.generated.json";

// ---------------------------------------------------------------------------
// The floating "Ask" button and the panel it opens: a drawer on the right on
// larger screens, the full screen on a phone. The conversation lives inside
// AskChat, which stays mounted once opened so closing the panel and moving
// around the site does not lose the thread.
// ---------------------------------------------------------------------------

export function AskPanel() {
  const { isOpen, close, open, pending, aiEnabled } = useAsk();
  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const openedOnce = useRef(false);
  const pathname = usePathname();
  const lastPath = useRef(pathname);

  if (isOpen) openedOnce.current = true;

  // Escape closes; the page behind stops scrolling while the panel is open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, close]);

  // Following a link to an event should show the event, not the panel.
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      close();
    }
  }, [pathname, close]);

  // Hand focus back to the button when the panel closes.
  useEffect(() => {
    if (!isOpen && openedOnce.current) fabRef.current?.focus();
  }, [isOpen]);

  return (
    <>
      {/* Floating button */}
      <button
        ref={fabRef}
        type="button"
        onClick={() => open()}
        aria-label="Ask what's going on"
        aria-expanded={isOpen}
        aria-controls="ask-panel"
        className={cn(
          "fixed bottom-5 right-5 z-40 inline-flex h-14 items-center gap-2 rounded-full bg-brand-600 pl-4 pr-5 text-[15px] font-semibold text-white shadow-float ring-1 ring-white/20 transition duration-300 ease-out hover:-translate-y-0.5 hover:bg-brand-700 active:scale-[0.97] sm:bottom-6 sm:right-6",
          isOpen && "pointer-events-none translate-y-4 opacity-0",
        )}
      >
        <Sparkles aria-hidden className="h-5 w-5" strokeWidth={2.25} />
        Ask
      </button>

      {/* Backdrop */}
      <div
        aria-hidden
        onClick={close}
        className={cn(
          "fixed inset-0 z-[60] bg-ink/25 backdrop-blur-[2px] transition-opacity duration-300",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Panel */}
      <div
        id="ask-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-panel-title"
        aria-hidden={!isOpen}
        className={cn(
          "fixed inset-y-0 right-0 z-[70] flex w-full flex-col bg-canvas shadow-float transition-[transform,visibility] duration-300 ease-out sm:w-[440px] sm:border-l sm:border-ink/10",
          isOpen ? "visible translate-x-0" : "invisible translate-x-full",
        )}
      >
        <header className="flex items-start gap-3 border-b border-ink/10 px-5 pb-4 pt-5">
          <span
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent-100 text-brand-600 ring-1 ring-accent-200"
          >
            <Sparkles className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="ask-panel-title" className="text-[17px] font-bold tracking-tight text-ink">
              What&apos;s going on?
            </h2>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">
              Ask about a day, a weekend, a venue, or a kind of event.{" "}
              <span className="tabular">{meta.events.toLocaleString("en-US")}</span> listings from{" "}
              {meta.sources} local sources.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="-mr-2 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-muted transition hover:bg-ink/[0.05] hover:text-ink"
          >
            <X className="h-5 w-5" strokeWidth={2.25} />
          </button>
        </header>

        {openedOnce.current && (
          <AskChat aiEnabled={aiEnabled} pending={pending} active={isOpen} />
        )}
      </div>
    </>
  );
}
