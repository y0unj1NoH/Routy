import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const isDevelopment = process.env.NODE_ENV === "development";
const distDir = process.env.NEXT_DIST_DIR || (isDevelopment ? ".next-dev" : ".next");
const hasSentrySourceMapConfig = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep dev and verification artifacts isolated so a verification build does not break a running dev server.
  distDir,
  outputFileTracingRoot: path.join(__dirname, ".."),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "places.googleapis.com"
      },
      {
        protocol: "https",
        hostname: "maps.gstatic.com"
      }
    ]
  }
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  webpack: {
    treeshake: {
      removeDebugLogging: true
    }
  },
  ...(hasSentrySourceMapConfig
    ? {
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        widenClientFileUpload: true
      }
    : {})
});
