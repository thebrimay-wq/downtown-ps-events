import Link from "next/link";

// Short labels keep the bar on one line at 375px; the full wording returns as
// soon as there is room for it.
const NAV = [
  { href: "/events", label: "Events", shortLabel: "Events" },
  { href: "/ask", label: "Ask", shortLabel: "Ask" },
  { href: "/admin", label: "Admin", shortLabel: "Admin" },
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

        <nav className="flex items-center gap-1 sm:gap-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-3 text-sm font-semibold text-ink-soft transition duration-200 hover:bg-ink/[0.05] hover:text-ink"
            >
              <span className="sm:hidden">{item.shortLabel}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          ))}
          <Link
            href="/submit"
            className="ml-1 inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-brand-700"
          >
            <span className="sm:hidden">Submit</span>
            <span className="hidden sm:inline">Submit an event</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
