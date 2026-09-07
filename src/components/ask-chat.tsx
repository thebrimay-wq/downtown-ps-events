"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, CalendarDays, ExternalLink, MapPin, RotateCcw, Sparkles, Square } from "lucide-react";
import type { ChatEvent, SourceCard } from "@/lib/ai/chat";
import { MarkdownLite } from "./markdown-lite";
import { CategoryIcon } from "./category-icon";
import { categoryMeta } from "@/lib/categories";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// The conversation on /ask. Sends the thread to /api/chat and renders the
// reply as it streams in: text first, a status line while a search runs,
// and event cards once the answer is complete.
// ---------------------------------------------------------------------------

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: string | null;
  sources?: SourceCard[];
  error?: string | null;
  done?: boolean;
}

const SUGGESTIONS = [
  "What's happening this weekend?",
  "Anything free for kids this week?",
  "Live music in Pleasanton in October",
  "Wine events in Livermore this month",
  "What's on at the Firehouse Arts Center?",
  "Is there anything going on tonight?",
];

// The box grows with the question up to its max height, then scrolls.
function grow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
}

let counter = 0;
const nextId = () => `m${Date.now().toString(36)}${(counter += 1)}`;

export function AskChat({
  aiEnabled,
  initialQuestion,
}: {
  aiEnabled: boolean;
  initialQuestion?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const started = useRef(false);

  const patch = useCallback((id: string, update: (m: Message) => Message) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? update(m) : m)));
  }, []);

  const send = useCallback(
    async (question: string, history: Message[]) => {
      const text = question.trim();
      if (!text || busy) return;
      const userMsg: Message = { id: nextId(), role: "user", content: text };
      const replyId = nextId();
      const reply: Message = {
        id: replyId,
        role: "assistant",
        content: "",
        status: aiEnabled ? "Thinking…" : "Searching the listings…",
      };
      const thread = [...history, userMsg];
      setMessages([...thread, reply]);
      setInput("");
      setBusy(true);
      if (textareaRef.current) textareaRef.current.style.height = "auto";

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: thread.map((m) => ({ role: m.role, content: m.content })),
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Something went wrong. Please try again.");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            let event: ChatEvent;
            try {
              event = JSON.parse(line) as ChatEvent;
            } catch {
              continue;
            }
            patch(replyId, (m) => apply(m, event));
          }
        }
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer) as ChatEvent;
            patch(replyId, (m) => apply(m, event));
          } catch {
            // A torn final line: the done event carries nothing we need.
          }
        }
        patch(replyId, (m) => ({ ...m, status: null, done: true }));
      } catch (err) {
        const aborted = controller.signal.aborted;
        patch(replyId, (m) => ({
          ...m,
          status: null,
          done: true,
          error: aborted
            ? null
            : err instanceof Error
              ? err.message
              : "Something went wrong. Please try again.",
          content: aborted && !m.content ? "Stopped." : m.content,
        }));
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    },
    [aiEnabled, busy, patch],
  );

  // A question can arrive in the URL (?q=…) from the homepage.
  useEffect(() => {
    if (initialQuestion && !started.current) {
      started.current = true;
      void send(initialQuestion, []);
    }
  }, [initialQuestion, send]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages]);

  function stop() {
    abortRef.current?.abort();
  }

  function reset() {
    stop();
    setMessages([]);
    setInput("");
    textareaRef.current?.focus();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send(input, messages);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input, messages);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex min-h-[60vh] flex-col">
      {empty ? (
        <div className="animate-fade-up">
          <p className="eyebrow text-ink-muted">Try asking</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s, [])}
                className="inline-flex min-h-11 items-center rounded-full bg-canvas-raised px-4 text-sm font-semibold text-ink-soft ring-1 ring-ink/10 transition duration-200 hover:-translate-y-0.5 hover:text-ink hover:shadow-card"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ol className="flex flex-col gap-6" aria-live="polite" aria-busy={busy}>
          {messages.map((m) =>
            m.role === "user" ? (
              <li key={m.id} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-brand-600 px-4 py-2.5 text-[15px] leading-relaxed text-white shadow-sm sm:max-w-[75%]">
                  {m.content}
                </p>
              </li>
            ) : (
              <li key={m.id} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-100 text-brand-600 ring-1 ring-accent-200"
                >
                  <Sparkles className="h-4 w-4" strokeWidth={2.25} />
                </span>
                <div className="min-w-0 flex-1">
                  {m.content && (
                    <div className="text-[15px] leading-relaxed text-ink-soft">
                      <MarkdownLite text={m.content} />
                    </div>
                  )}
                  {m.status && (
                    <p className="mt-2 flex items-center gap-2 text-sm text-ink-muted">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
                      </span>
                      {m.status}
                    </p>
                  )}
                  {m.error && (
                    <p className="mt-2 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-800 ring-1 ring-brand-200">
                      {m.error}
                    </p>
                  )}
                  {m.sources && m.sources.length > 0 && <Sources cards={m.sources} />}
                </div>
              </li>
            ),
          )}
        </ol>
      )}
      <div ref={endRef} />

      <form
        onSubmit={onSubmit}
        className="sticky bottom-4 mt-8 rounded-3xl bg-canvas-raised p-2 shadow-float ring-1 ring-ink/10 transition focus-within:ring-2 focus-within:ring-brand-500"
      >
        <div className="flex items-end gap-2">
          <label htmlFor="ask-input" className="sr-only">
            Ask about events
          </label>
          <textarea
            id="ask-input"
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              grow(e.target);
            }}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={2000}
            placeholder={empty ? "Ask what's going on…" : "Ask a follow-up…"}
            autoFocus
            className="max-h-40 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-3 py-2.5 text-base leading-relaxed text-ink placeholder:text-ink-muted focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              aria-label="Stop"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink text-white shadow-sm transition hover:bg-ink-soft"
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white shadow-sm transition duration-200 hover:bg-brand-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-ink-muted"
            >
              <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </form>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-ink-muted">
        <span>
          {aiEnabled
            ? "Answers are AI-generated from crawled listings and can be wrong. Check the source before you go."
            : "Keyword search only until an ANTHROPIC_API_KEY is configured."}
        </span>
        {!empty && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 font-semibold text-ink-soft transition-colors hover:text-brand-600"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.25} />
            New conversation
          </button>
        )}
      </div>
    </div>
  );
}

function apply(m: Message, event: ChatEvent): Message {
  switch (event.type) {
    case "text":
      return { ...m, content: m.content + event.text, status: null };
    case "status":
      return { ...m, status: event.text };
    case "sources":
      return { ...m, sources: event.events };
    case "error":
      return { ...m, error: event.message, status: null };
    case "done":
      return { ...m, status: null, done: true };
    default:
      return m;
  }
}

function Sources({ cards }: { cards: SourceCard[] }) {
  return (
    <div className="mt-4">
      <p className="eyebrow text-ink-muted">Events mentioned</p>
      <ul className="no-scrollbar -mx-1 mt-2 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
        {cards.map((c) => {
          const meta = categoryMeta(c.category);
          const inner = (
            <>
              <span className="flex items-start gap-2">
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                  style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
                >
                  <CategoryIcon slug={c.category} className="h-3.5 w-3.5" />
                </span>
                <span className="line-clamp-2 text-[13px] font-bold leading-tight text-ink">{c.title}</span>
              </span>
              <span className="mt-2 flex items-start gap-1.5 text-xs text-ink-muted">
                <CalendarDays aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                <span className="line-clamp-1">{c.when ?? c.date ?? "Date not listed"}</span>
              </span>
              {(c.venue || c.city) && (
                <span className="mt-1 flex items-start gap-1.5 text-xs text-ink-muted">
                  <MapPin aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  <span className="line-clamp-1">{c.venue ?? c.city}</span>
                </span>
              )}
              <span className="mt-2 flex items-center justify-between text-xs">
                <span className="font-semibold text-ink-soft">
                  {c.is_free ? "Free" : c.price ?? ""}
                </span>
                {!c.link && <ExternalLink aria-hidden className="h-3.5 w-3.5 text-ink-faint" />}
              </span>
            </>
          );
          const className = cn(
            "flex w-56 shrink-0 snap-start flex-col rounded-2xl bg-canvas-raised p-3.5 shadow-card ring-1 ring-ink/10 transition duration-200 hover:-translate-y-0.5 hover:shadow-card-hover",
          );
          return (
            <li key={c.id} className="flex">
              {c.link ? (
                <Link href={c.link} className={className}>
                  {inner}
                </Link>
              ) : c.url ? (
                <a href={c.url} target="_blank" rel="noopener noreferrer" className={className}>
                  {inner}
                </a>
              ) : (
                <div className={className}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
