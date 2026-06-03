import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Lets the E2E harness build/serve into an isolated dir (.next-e2e) so it can run
  // alongside `next dev` (which owns .next) without conflict.
  ...(process.env.E2E_DISTDIR ? { distDir: process.env.E2E_DISTDIR } : {}),
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cards.scryfall.io",
      },
      {
        protocol: "https",
        hostname: "*.scryfall.io",
      },
    ],
  },
}

export default nextConfig
