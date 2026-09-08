import Link from "next/link";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Renders the small slice of markdown the assistant writes: paragraphs,
// bullet and numbered lists, bold, and links. Nothing is passed through as
// HTML, so model output can never inject markup into the page.
// ---------------------------------------------------------------------------

const INLINE = /(\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*)/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    if (m[2] !== undefined) {
      const href = m[3];
      const label = m[2];
      const internal = href.startsWith("/");
      out.push(
        internal ? (
          <Link
            key={`${keyPrefix}-${i}`}
            href={href}
            className="font-semibold text-brand-600 underline decoration-brand-600/30 underline-offset-[3px] transition-colors hover:text-brand-700 hover:decoration-brand-700/60"
          >
            {label}
          </Link>
        ) : /^https?:\/\//.test(href) ? (
          <a
            key={`${keyPrefix}-${i}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-600 underline decoration-brand-600/30 underline-offset-[3px] transition-colors hover:text-brand-700"
          >
            {label}
          </a>
        ) : (
          label
        ),
      );
    } else if (m[4] !== undefined) {
      out.push(
        <strong key={`${keyPrefix}-${i}`} className="font-semibold text-ink">
          {m[4]}
        </strong>,
      );
    }
    last = start + m[0].length;
    i += 1;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "ul" | "ol"; items: string[] };

function blocks(markdown: string): Block[] {
  const out: Block[] = [];
  let list: { kind: "ul" | "ol"; items: string[] } | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) out.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  const flushList = () => {
    if (list) out.push(list);
    list = null;
  };
  for (const raw of markdown.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const number = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (bullet || number) {
      flushPara();
      const kind = bullet ? "ul" : "ol";
      if (!list || list.kind !== kind) {
        flushList();
        list = { kind, items: [] };
      }
      list.items.push((bullet ?? number)![1]);
    } else if (heading) {
      flushPara();
      flushList();
      out.push({ kind: "h", text: heading[1] });
    } else if (line.trim() === "") {
      flushPara();
      flushList();
    } else if (list && /^\s+/.test(raw)) {
      // Indented continuation of the previous list item.
      list.items[list.items.length - 1] += ` ${line.trim()}`;
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return out;
}

export function MarkdownLite({ text }: { text: string }) {
  return (
    <>
      {blocks(text).map((block, i) => {
        if (block.kind === "h") {
          return (
            <p key={i} className="mt-4 text-[15px] font-bold text-ink first:mt-0">
              {inline(block.text, `h${i}`)}
            </p>
          );
        }
        if (block.kind === "p") {
          return (
            <p key={i} className="mt-3 first:mt-0">
              {inline(block.text, `p${i}`)}
            </p>
          );
        }
        const Tag = block.kind;
        return (
          <Tag
            key={i}
            className={
              block.kind === "ul"
                ? "mt-3 list-disc space-y-1.5 pl-5 marker:text-brand-400 first:mt-0"
                : "mt-3 list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-brand-600 first:mt-0"
            }
          >
            {block.items.map((item, j) => (
              <li key={j} className="pl-0.5">
                {inline(item, `l${i}-${j}`)}
              </li>
            ))}
          </Tag>
        );
      })}
    </>
  );
}
