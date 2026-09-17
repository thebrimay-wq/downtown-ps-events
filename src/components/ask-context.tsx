"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// One piece of shared state for the Ask panel: whether it is open, and a
// question to send the moment it opens. The header link, the homepage prompt,
// and the floating button all talk to it; the panel itself listens.
// ---------------------------------------------------------------------------

interface AskState {
  isOpen: boolean;
  // A question queued by open(question). `key` changes each time so the same
  // question can be asked twice in a row.
  pending: { text: string; key: number } | null;
  open: (question?: string) => void;
  close: () => void;
  toggle: () => void;
}

const AskContext = createContext<AskState | null>(null);

export function AskProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [pending, setPending] = useState<AskState["pending"]>(null);

  const open = useCallback((question?: string) => {
    setOpen(true);
    const text = question?.trim();
    if (text) setPending({ text, key: Date.now() });
  }, []);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo(
    () => ({ isOpen, pending, open, close, toggle }),
    [isOpen, pending, open, close, toggle],
  );
  return <AskContext.Provider value={value}>{children}</AskContext.Provider>;
}

export function useAsk(): AskState {
  const ctx = useContext(AskContext);
  if (!ctx) throw new Error("useAsk must be used inside <AskProvider>");
  return ctx;
}

// A plain button that opens the panel, styled by whoever renders it.
export function AskTrigger({
  question,
  className,
  children,
}: {
  question?: string;
  className?: string;
  children: ReactNode;
}) {
  const { open } = useAsk();
  return (
    <button type="button" onClick={() => open(question)} className={className}>
      {children}
    </button>
  );
}
