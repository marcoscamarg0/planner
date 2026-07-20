import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  // Playwright and related packages must run only on the Node.js server side
  serverExternalPackages: [
    "@playwright/test",
    "playwright",
    "playwright-core",
    "@axe-core/playwright",
    "bullmq",
    "ioredis",
  ],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
};

export default nextConfig;
