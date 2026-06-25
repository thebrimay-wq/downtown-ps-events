/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Scraped/submitted events carry images from arbitrary public hosts that
    // can't be enumerated ahead of time. Skip the optimizer so any https image
    // renders without a per-host allowlist.
    unoptimized: true,
  },
};

export default nextConfig;
