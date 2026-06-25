import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

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
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
