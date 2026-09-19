import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AskTrigger } from "./ask-context";

// The bar has to fit a 360px phone with the logo, two links and the Submit
// pill on one line, so below `sm` the labels are short and the padding is
// tight; the full wording and spacing return as soon as there is room.
const NAV = [
  { href: "/events", label: "Events", shortLabel: "Events" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-ink/10 glass">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5 rounded-xl">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-600 text-white shadow-sm transition duration-200 group-hover:bg-brand-700">
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" /><path d="M9 21v-6h6v6" />
            </svg>
          </span>
          <span className="flex flex-col leading-none">
            <span className="whitespace-nowrap text-[15px] font-bold tracking-tight text-ink">Pleasanton</span>
            <span className="eyebrow whitespace-nowrap text-[0.625rem] text-ink-muted">Events Hub</span>
          </span>
          <span className="sr-only">— home</span>
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-2.5 text-sm font-semibold text-ink-soft transition duration-200 hover:bg-ink/[0.05] hover:text-ink sm:px-3"
            >
              <span className="sm:hidden">{item.shortLabel}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          ))}
          <AskTrigger className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-sm font-semibold text-ink-soft transition duration-200 hover:bg-ink/[0.05] hover:text-ink sm:px-3">
            <Sparkles aria-hidden className="h-4 w-4 text-brand-600" strokeWidth={2.25} />
            Ask
          </AskTrigger>
          <Link
            href="/submit"
            className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-brand-600 px-3.5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-brand-700 sm:ml-1 sm:px-4"
          >
            <span className="sm:hidden">Submit</span>
            <span className="hidden sm:inline">Submit an event</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
