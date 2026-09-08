import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AskProvider } from "@/components/ask-context";
import { AskPanel } from "@/components/ask-panel";

// One family, hierarchy by weight. Instrument Sans is crisp and slightly
// narrow, with a friendly single-storey a — warmer than a neutral grotesque
// without giving up any rigour.
const sans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Pleasanton Events Hub — What's happening in Pleasanton?",
    template: "%s · Pleasanton Events Hub",
  },
  description:
    "A centralized, always-current calendar of local events in Pleasanton, California — concerts, markets, festivals, family fun, and more, gathered from across the community.",
  openGraph: {
    title: "Pleasanton Events Hub",
    description: "What's happening in Pleasanton? Find local events all in one place.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="flex min-h-dvh flex-col">
        <AskProvider>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <AskPanel />
        </AskProvider>
      </body>
    </html>
  );
}
