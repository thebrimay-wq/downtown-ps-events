import type { MetadataRoute } from "next";
import { getEvents } from "@/lib/data";

// Rendered per request, never prerendered. NEXT_PUBLIC_SITE_URL is a Worker
// var that exists at runtime but not during `next build`, so a prerendered
// sitemap would bake in the localhost fallback and ship it to crawlers.
// Rendering on demand also means a newly approved event is listed at once.
export const dynamic = "force-dynamic";

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/events`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/submit`, changeFrequency: "monthly", priority: 0.4 },
  ];

  // Upcoming events only. A past event's page still resolves, but listing
  // thousands of expired dates dilutes the sitemap and earns nothing —
  // crawlers spend their budget on pages a visitor would actually want.
  // /admin is deliberately absent; it is disallowed in robots.txt.
  const events = await getEvents({}, { upcomingOnly: true });

  const eventPages: MetadataRoute.Sitemap = events.map((event) => ({
    url: `${base}/events/${event.slug ?? event.id}`,
    lastModified: new Date(event.updated_at ?? event.start_at),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...eventPages];
}
