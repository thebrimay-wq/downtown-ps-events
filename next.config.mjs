import path from "node:path";
import { fileURLToPath } from "node:url";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Lets `next dev` reach Cloudflare bindings/vars the same way the deployed
// Worker does. No-op during `next build`.
initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the tracing root to this project so a lockfile in a parent folder
  // can't make Next pick the wrong workspace root (breaks the Worker build).
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  images: {
    // Scraped/submitted events carry images from arbitrary public hosts that
    // can't be enumerated ahead of time. Skip the optimizer so any https image
    // renders without a per-host allowlist.
    unoptimized: true,
  },
  // Keep one canonical address: anything arriving on www is sent to the bare
  // domain, path and query intact. Matched on the Host header, so local dev
  // and the *.workers.dev hostname are untouched.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.pleasantonevents.com" }],
        destination: "https://pleasantonevents.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
