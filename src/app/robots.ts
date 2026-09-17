import type { MetadataRoute } from "next";

// Same reason as sitemap.ts: prerendering this at build time would freeze in
// the localhost fallback for NEXT_PUBLIC_SITE_URL, pointing crawlers at a
// sitemap URL that does not exist.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The dashboard is secret-gated and the API returns JSON the site
      // already renders as HTML; neither belongs in a search index.
      disallow: ["/admin", "/api/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
