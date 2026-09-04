import Link from "next/link";

// Short labels keep the bar on one line at 375px; the full wording returns as
// soon as there is room for it.
const NAV = [
  { href: "/events", label: "Events", shortLabel: "Events" },
  { href: "/submit", label: "Submit an Event", shortLabel: "Submit" },
  { href: "/admin", label: "Admin", shortLabel: "Admin" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/5 glass">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5 rounded-2xl"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-brand-500 text-white shadow-card transition duration-200 group-hover:scale-105">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M3 21h18" />
              <path d="M5 21V8l7-5 7 5v13" />
              <path d="M9 21v-6h6v6" />
            </svg>
          </span>
          <span className="flex flex-col leading-none">
            <span className="whitespace-nowrap text-[15px] font-semibold tracking-tight">
              Pleasanton
            </span>
            <span className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.18em] text-ink-muted">
              Events Hub
            </span>
          </span>
          <span className="sr-only">— home</span>
        </Link>

        <nav className="flex items-center gap-0.5 text-sm sm:gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-2.5 font-medium text-ink-soft transition duration-200 hover:bg-black/[0.04] hover:text-ink sm:px-3.5"
            >
              <span className="sm:hidden">{item.shortLabel}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
